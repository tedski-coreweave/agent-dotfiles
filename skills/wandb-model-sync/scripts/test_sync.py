import contextlib, hashlib, importlib.util, io, json, sys, tempfile, unittest, urllib.error, urllib.request
from pathlib import Path
from unittest.mock import patch
spec=importlib.util.spec_from_file_location("sync",Path(__file__).with_name("sync.py"));sync=importlib.util.module_from_spec(spec);spec.loader.exec_module(sync)
M={"idPlayground":"x/y","label":"X","contextWindow":262144,"modalitiesInput":["text"],"modalitiesOutput":["text"],"featureReasoning":False,"featureToolCalling":True,"lifecycleStage":"general-availability"}
D={"p":{"models":{"x/y":{"id":"x/y","reasoning":False,"tool_call":True,"modalities":{"input":["text"]},"limit":{"context":262144,"output":32768}}}}}
class TestSync(unittest.TestCase):
 def cli(self,args,fetches=None):
  with patch.object(sys,"argv",["sync.py",*map(str,args)]),patch.object(sync,"credential",return_value="SENTINEL"),patch.object(sync,"fetch",side_effect=fetches or []):
   return sync.main()
 def test_reconcile_and_categories(self):
  models,errors=sync.reconcile({"data":[{"id":"x/y"}]},{"models":[M]},D);self.assertEqual(errors,[]);self.assertEqual(sync.changes([],models)["added"],["x/y"])
 def test_invalid_and_unmapped_block(self):
  _,errors=sync.reconcile({"data":[{"id":"none"},{"id":"x/y"}]},{"models":[{**M,"modalitiesInput":["audio"]}]},D);self.assertEqual(len(errors),2)
 def test_malformed_top_level_schemas_fail_closed(self):
  for args in (([],{"models":[M]},D),({"data":[]},[],D),({"data":[]},{"models":[]},[])):
   with self.assertRaises(sync.Failure):sync.reconcile(*args)
 def test_strict_metadata_and_duplicate_ids_block(self):
  for changed in ({**M,"label":""},{**M,"modalitiesOutput":[]},{**M,"featureReasoning":"false"},{**M,"lifecycleStage":"gone"}):
   _,errors=sync.reconcile({"data":[{"id":"x/y"}]},{"models":[changed]},D);self.assertTrue(errors)
  _,errors=sync.reconcile({"data":[{"id":"x/y"},{"id":"x/y"}]},{"models":[M]},D);self.assertTrue(any("duplicate" in error for error in errors))
 def test_fetch_does_not_follow_credentialed_redirect(self):
  class Opener:
   def __init__(self):self.requests=[]
   def open(self,request,timeout):
    self.requests.append(request);raise urllib.error.HTTPError(request.full_url,302,"redirect",{},None)
  opener=Opener()
  with patch.object(urllib.request,"build_opener",return_value=opener):
   with self.assertRaises(sync.Failure):sync.fetch("https://example.test/models","SENTINEL")
  self.assertEqual(len(opener.requests),1);self.assertEqual(opener.requests[0].get_header("Authorization"),"Bearer SENTINEL")
 def test_lifecycle_change_uses_previous_snapshot(self):
  current=[{"id":"x/y","name":"X","input":["text"],"contextWindow":262144,"maxTokens":32768,"reasoning":False}]
  wanted=[{**current[0],"lifecycleStage":"deprecated"}]
  prior=[{**wanted[0],"lifecycleStage":"general-availability"}]
  self.assertEqual(sync.changes(current,wanted,prior)["lifecycle"][0]["to"],"deprecated")
 def test_sentinel_not_in_report_shape(self):
  self.assertNotIn("secret",str(sync.changes([],[])))
 def test_cli_baseline_missing_writes_structured_exit_two(self):
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp); config=root/"models.json";config.write_text(json.dumps({"providers":{"WandB-Inference":{"models":[]}}}))
   out=Path(".pi_tmp/wandb-model-sync/test-missing.json")
   code=self.cli(["--output",out,"--config",config,"--baseline",root/"missing"],[{"data":[]},{"models":[]},{},{}])
   self.assertEqual(code,2);self.assertIn("OpenAPI baseline",json.loads(out.read_text())["errors"][0])
 def test_cli_writes_reviewed_baseline(self):
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp); config=root/"models.json";config.write_text(json.dumps({"providers":{"WandB-Inference":{"models":[]}}})); baseline=root/"hash";out=Path(".pi_tmp/wandb-model-sync/test-baseline.json");schema={"openapi":"3"}
   self.assertEqual(self.cli(["--output",out,"--config",config,"--baseline",baseline,"--write-openapi-baseline"],[{"data":[]},{"models":[]},{},schema]),0)
   self.assertEqual(json.loads(baseline.read_text())["sha256"],hashlib.sha256(json.dumps(schema,sort_keys=True,separators=(",",":")).encode()).hexdigest())
 def test_cli_check_does_not_write_and_apply_uses_snapshot(self):
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp); config=root/"models.json"; original={"providers":{"WandB-Inference":{"models":[]}}};config.write_text(json.dumps(original)); model={"id":"x/y","name":"X","input":["text"],"contextWindow":1,"maxTokens":1,"reasoning":False,"lifecycleStage":"general-availability","toolCalling":False}; snap=root/"snapshot.json";snap.write_text(json.dumps({"models":[model],"errors":[]}));out=Path(".pi_tmp/wandb-model-sync/test-apply.json")
   self.assertEqual(self.cli(["--output",out,"--config",config,"--snapshot",snap]),1);self.assertEqual(json.loads(config.read_text()),original)
   self.assertEqual(self.cli(["--output",out,"--config",config,"--snapshot",snap,"--apply"]),0);self.assertEqual(json.loads(config.read_text())["providers"]["WandB-Inference"]["models"][0]["id"],"x/y")
 def test_cli_hash_mismatch_and_op_failure_are_redacted(self):
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp); config=root/"models.json";config.write_text(json.dumps({"providers":{"WandB-Inference":{"models":[]}}})); base=root/"baseline";base.write_text(json.dumps({"source":sync.OPENAPI,"retrievedAt":"x","canonicalization":"json.dumps(sort_keys=True,separators=(',', ':'))/sha256-v1","sha256":"wrong"}));out=Path(".pi_tmp/wandb-model-sync/test-errors.json")
   self.assertEqual(self.cli(["--output",out,"--config",config,"--baseline",base],[{"data":[]},{"models":[]},{},{"x":1}]),2);self.assertIn("schema hash",json.loads(out.read_text())["errors"][0])
   with patch.object(sys,"argv",["sync.py","--output",str(out),"--config",str(config)]),patch.object(sync,"credential",side_effect=sync.Failure("SENTINEL")):
    self.assertEqual(sync.main(),2)
   self.assertNotIn("SENTINEL",out.read_text())
 def test_failed_check_preserves_successful_state(self):
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp); state=root/"state";state.write_text('{"keep":true}');config=root/"models.json";config.write_text(json.dumps({"providers":{"WandB-Inference":{"models":[]}}}));base=root/"baseline";base.write_text(json.dumps({"source":sync.OPENAPI,"retrievedAt":"x","canonicalization":"json.dumps(sort_keys=True,separators=(',', ':'))/sha256-v1","sha256":"wrong"}));out=Path(".pi_tmp/wandb-model-sync/test-state.json")
   self.assertEqual(self.cli(["--output",out,"--state",state,"--config",config,"--baseline",base],[{"data":[]},{"models":[]},{},{"x":1}]),2);self.assertEqual(state.read_text(),'{"keep":true}')
 def test_output_traversal_and_root_are_rejected_before_write(self):
  for outside in (Path(".pi_tmp/wandb-model-sync/../escape.json"),Path(".pi_tmp/wandb-model-sync")):
   with patch.object(sys,"argv",["sync.py","--output",str(outside)]):
    with self.assertRaises(SystemExit):sync.main()
  self.assertFalse(Path(".pi_tmp/escape.json").exists())
 def test_existing_directory_output_returns_structured_exit_two(self):
  output=Path(".pi_tmp/wandb-model-sync/test-directory-output");output.mkdir(parents=True,exist_ok=True);stream=io.StringIO()
  with patch.object(sys,"argv",["sync.py","--output",str(output)]),contextlib.redirect_stdout(stream): self.assertEqual(sync.main(),2)
  self.assertEqual(json.loads(stream.getvalue())["errors"],["output path is a directory"])
 def test_unmanaged_unmatched_model_is_quarantined_not_blocking(self):
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp); state=root/"state"; config=root/"models.json"; wanted={"id":"x/y","name":"X","reasoning":False,"input":["text"],"contextWindow":262144,"maxTokens":32768};config.write_text(json.dumps({"providers":{"WandB-Inference":{"models":[wanted]}}}));schema={"x":1};digest=hashlib.sha256(json.dumps(schema,sort_keys=True,separators=(",",":")).encode()).hexdigest();base=root/"baseline";base.write_text(json.dumps({"source":sync.OPENAPI,"retrievedAt":"x","canonicalization":"json.dumps(sort_keys=True,separators=(',', ':'))/sha256-v1","sha256":digest}));out=Path(".pi_tmp/wandb-model-sync/test-quarantine.json")
   self.assertEqual(self.cli(["--output",out,"--state",state,"--config",config,"--baseline",base],[{"data":[{"id":"x/y"},{"id":"missing"}]},{"models":[M]},D,schema]),0)
   self.assertEqual(json.loads(out.read_text())["quarantined"],["missing"])
   managed={"id":"missing","name":"Missing","reasoning":False,"input":["text"],"contextWindow":1,"maxTokens":1};config.write_text(json.dumps({"providers":{"WandB-Inference":{"models":[managed]}}}))
   self.assertEqual(self.cli(["--output",out,"--state",state,"--config",config,"--baseline",base],[{"data":[{"id":"missing"}]},{"models":[M]},D,schema]),2)
   blocked=json.loads(out.read_text());self.assertIn("unmapped:missing",blocked["errors"]);self.assertEqual(blocked["quarantined"],[])
 def test_two_checks_persist_then_report_lifecycle(self):
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp); state=root/"state.json"; config=root/"models.json"; wanted={"id":"x/y","name":"X","reasoning":False,"input":["text"],"contextWindow":262144,"maxTokens":32768};config.write_text(json.dumps({"providers":{"WandB-Inference":{"models":[wanted]}}}));schema={"x":1};digest=hashlib.sha256(json.dumps(schema,sort_keys=True,separators=(",",":")).encode()).hexdigest();base=root/"baseline";base.write_text(json.dumps({"source":sync.OPENAPI,"retrievedAt":"x","canonicalization":"json.dumps(sort_keys=True,separators=(',', ':'))/sha256-v1","sha256":digest}));first=Path(".pi_tmp/wandb-model-sync/test-first.json");second=Path(".pi_tmp/wandb-model-sync/test-second.json")
   self.assertEqual(self.cli(["--output",first,"--state",state,"--config",config,"--baseline",base],[{"data":[{"id":"x/y"}]},{"models":[M]},D,schema]),0);self.assertTrue(state.exists())
   changed={**M,"lifecycleStage":"deprecated"};self.assertEqual(self.cli(["--output",second,"--state",state,"--config",config,"--baseline",base],[{"data":[{"id":"x/y"}]},{"models":[changed]},D,schema]),1);self.assertEqual(json.loads(second.read_text())["changes"]["lifecycle"][0]["to"],"deprecated")
if __name__=="__main__":unittest.main()
