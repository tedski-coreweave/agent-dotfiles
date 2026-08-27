#!/usr/bin/env python3
"""Check W&B model metadata. Snapshots and reports never contain credentials."""
import argparse, hashlib, json, subprocess, sys, urllib.error, urllib.request
from datetime import UTC, datetime
from pathlib import Path
API="https://api.inference.wandb.ai/v1/models"; CATALOG="https://trace.wandb.ai/inference/catalog/models"; DEV="https://trace.wandb.ai/inference/modelsdev/models"; OPENAPI="https://trace.wandb.ai/openapi.json"; STATE=Path(".pi_tmp/wandb-model-sync/latest-successful.json")
class Failure(Exception): pass
class NoRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,*args): raise Failure("redirect refused")
def fetch(url, token=None):
 h={"Accept":"application/json","User-Agent":"agent-dotfiles-wandb-model-sync/1"}
 if token:h["Authorization"]="Bearer "+token
 try:
  # NoRedirect prevents urllib from reissuing a credentialed request to Location.
  with urllib.request.build_opener(NoRedirect).open(urllib.request.Request(url,headers=h),timeout=30) as r:return json.load(r)
 except Failure: raise
 except (urllib.error.URLError,urllib.error.HTTPError,json.JSONDecodeError) as e: raise Failure(f"fetch failed for {url}: {type(e).__name__}")
def credential():
 r=subprocess.run(["op","read","op://Employee/wandb_inference/credential"],capture_output=True,text=True)
 if r.returncode or not r.stdout.strip():raise Failure("1Password credential resolution failed")
 return r.stdout.strip()
def devmap(payload):
 out={}
 for provider in payload.values():
  for key,value in provider.get("models",{}).items():
   if key in out or value.get("id")!=key:raise Failure("invalid or duplicate models.dev ID")
   out[key]=value
 return out
def valid(model,dev):
 required=("label","contextWindow","modalitiesInput","modalitiesOutput","featureReasoning","featureToolCalling","lifecycleStage")
 if any(k not in model for k in required) or not isinstance(model["label"],str) or not model["label"] or not isinstance(model["contextWindow"],int) or isinstance(model["contextWindow"],bool) or model["contextWindow"]<=0:return "invalid catalog fields"
 if not isinstance(model["modalitiesInput"],list) or not model["modalitiesInput"] or any(x not in ("text","image") for x in model["modalitiesInput"]):return "invalid input modalities"
 if not isinstance(model["modalitiesOutput"],list) or not model["modalitiesOutput"] or any(x not in ("text","image") for x in model["modalitiesOutput"]):return "invalid output modalities"
 if not isinstance(model["featureReasoning"],bool) or not isinstance(model["featureToolCalling"],bool) or model["lifecycleStage"] not in ("experimental","general-availability","deprecated","retired"):return "invalid capability metadata"
 limit=dev.get("limit",{}).get("output")
 if not isinstance(limit,int) or isinstance(limit,bool) or limit<=0:return "invalid output limit"
 if dev.get("limit",{}).get("context")!=model["contextWindow"] or dev.get("modalities",{}).get("input")!=model["modalitiesInput"] or dev.get("reasoning")!=model["featureReasoning"] or dev.get("tool_call")!=model["featureToolCalling"]:return "catalog disagreement"
def reconcile(endpoint,catalog,dev):
 if not isinstance(endpoint,dict) or not isinstance(endpoint.get("data"),list): raise Failure("invalid endpoint schema")
 if not isinstance(catalog,dict) or not isinstance(catalog.get("models"),list): raise Failure("invalid catalog schema")
 if not isinstance(dev,dict): raise Failure("invalid models.dev schema")
 cats={}; errors=[]
 for m in catalog.get("models",[]):
  key=m.get("idPlayground")
  if not key or key in cats: errors.append("duplicate or missing catalog ID")
  else: cats[key]=m
 ds=devmap(dev); models=[]; seen=set()
 for item in endpoint.get("data",[]):
  key=item.get("id")
  if not isinstance(key,str) or key in seen: errors.append(f"duplicate or invalid endpoint ID:{key}");continue
  seen.add(key); m,d=cats.get(key),ds.get(key)
  if not isinstance(key,str) or not m or not d:errors.append(f"unmapped:{key}");continue
  problem=valid(m,d)
  if problem:errors.append(f"{problem}:{key}");continue
  if m["lifecycleStage"]=="retired":errors.append(f"retired API model:{key}");continue
  models.append({"id":key,"name":m["label"],"input":m["modalitiesInput"],"contextWindow":m["contextWindow"],"maxTokens":d["limit"]["output"],"reasoning":m["featureReasoning"],"lifecycleStage":m["lifecycleStage"],"toolCalling":m["featureToolCalling"]})
 return sorted(models,key=lambda x:x["id"]),errors
def changes(current,wanted,previous=None):
 a={x["id"]:x for x in current};b={x["id"]:x for x in wanted}; old={x["id"]:x for x in (previous or [])}; out={"added":sorted(set(b)-set(a)),"removed":sorted(set(a)-set(b)),"metadata":[],"lifecycle":[],"output":[]}
 for key in sorted(set(a)&set(b)):
  for field in ("name","input","contextWindow","reasoning"):
   if a[key].get(field)!=b[key].get(field):out["metadata"].append({"id":key,"field":field,"from":a[key].get(field),"to":b[key].get(field)})
  if a[key].get("maxTokens")!=b[key].get("maxTokens"):out["output"].append({"id":key,"from":a[key].get("maxTokens"),"to":b[key].get("maxTokens")})
  if key in old and old[key].get("lifecycleStage")!=b[key].get("lifecycleStage"):out["lifecycle"].append({"id":key,"from":old[key].get("lifecycleStage"),"to":b[key].get("lifecycleStage")})
 return out
def atomic_write(path,data):
 path.parent.mkdir(parents=True,exist_ok=True); temporary=path.with_suffix(path.suffix+".tmp");temporary.write_text(json.dumps(data,indent=2)+"\n");temporary.replace(path)
def baseline(path):
 value=json.loads(path.read_text())
 if not isinstance(value,dict) or value.get("source")!=OPENAPI or value.get("canonicalization")!="json.dumps(sort_keys=True,separators=(',', ':'))/sha256-v1" or not isinstance(value.get("retrievedAt"),str) or not isinstance(value.get("sha256"),str):raise Failure("invalid OpenAPI baseline")
 return value

def main():
 p=argparse.ArgumentParser();p.add_argument("--output",type=Path,default=Path(".pi_tmp/wandb-model-sync/report.json"));p.add_argument("--snapshot",type=Path);p.add_argument("--previous-snapshot",type=Path);p.add_argument("--state",type=Path,default=STATE);p.add_argument("--config",type=Path,default=Path("pi/agent/models.json"));p.add_argument("--apply",action="store_true");p.add_argument("--baseline",type=Path,default=Path("skills/wandb-model-sync/openapi.sha256"));p.add_argument("--write-openapi-baseline",action="store_true",help="write a reviewed OpenAPI hash baseline");a=p.parse_args()
 root=Path(".pi_tmp/wandb-model-sync").resolve()
 try:
  relative=a.output.resolve().relative_to(root)
  if not relative.parts: raise ValueError
 except ValueError: p.error("--output must be a file below .pi_tmp/wandb-model-sync/")
 if a.output.exists() and a.output.is_dir():
  print(json.dumps({"errors":["output path is a directory"],"changes":{"added":[],"removed":[],"metadata":[],"lifecycle":[],"output":[]}}))
  return 2
 report={"retrievedAt":datetime.now(UTC).isoformat(),"sources":[API,CATALOG,DEV,OPENAPI],"openapiSha256":None,"models":[],"errors":[],"changes":{"added":[],"removed":[],"metadata":[],"lifecycle":[],"output":[]}}
 try:
  if a.apply and not a.snapshot:raise Failure("--apply requires a reviewed --snapshot")
  if a.snapshot: report=json.loads(a.snapshot.read_text())
  else:
   token=credential(); endpoint=fetch(API,token); cat=fetch(CATALOG);dev=fetch(DEV);schema=fetch(OPENAPI); digest=hashlib.sha256(json.dumps(schema,sort_keys=True,separators=(",",":")).encode()).hexdigest();report["openapiSha256"]=digest
   if a.write_openapi_baseline:
    atomic_write(a.baseline,{"source":OPENAPI,"retrievedAt":report["retrievedAt"],"canonicalization":"json.dumps(sort_keys=True,separators=(',', ':'))/sha256-v1","sha256":digest});report["baselineWritten"]=True
   elif not a.baseline.exists():raise Failure("OpenAPI baseline is missing; run reviewed --write-openapi-baseline")
   elif baseline(a.baseline)["sha256"]!=digest:raise Failure("OpenAPI schema hash changed")
   report["models"],report["errors"]=reconcile(endpoint,cat,dev)
   report["catalogLifecycle"]={m.get("idPlayground"):m.get("lifecycleStage") for m in cat.get("models",[]) if isinstance(m,dict)}
  config=json.loads(a.config.read_text()); current=config["providers"]["WandB-Inference"]["models"]; managed={model["id"] for model in current}; wanted=[{k:m[k] for k in ("id","name","reasoning","input","contextWindow","maxTokens")} for m in report.get("models",[])]
  quarantined=[error.removeprefix("unmapped:") for error in report["errors"] if error.startswith("unmapped:") and error.removeprefix("unmapped:") not in managed]
  report["quarantined"]=quarantined
  report["errors"]=[error for error in report["errors"] if error.removeprefix("unmapped:") not in quarantined]
  prior_path=a.previous_snapshot or a.state
  previous=[]
  if prior_path.exists():
   prior=json.loads(prior_path.read_text())
   if not isinstance(prior,dict) or not isinstance(prior.get("models",[]),list): raise Failure("invalid previous snapshot schema")
   previous=prior.get("models",[])
  report["changes"]=changes(current,report.get("models",[]),previous)
  available={model["id"] for model in report.get("models",[])}
  lifecycle=report.get("catalogLifecycle",{})
  absent=[model["id"] for model in current if model["id"] not in available and lifecycle.get(model["id"])!="retired"]
  if absent: report["errors"].extend(f"endpoint-absent model is not retired:{model_id}" for model_id in absent)
  if report.get("errors"):raise Failure("catalog reconciliation blocked")
  if not a.apply: atomic_write(a.state,report)
  if a.apply:config["providers"]["WandB-Inference"]["models"]=wanted;a.config.write_text(json.dumps(config,indent=2)+"\n")
  code=0 if not any(report["changes"].values()) or a.apply else 1
 except (Failure,KeyError,ValueError,TypeError,AttributeError,json.JSONDecodeError) as e:
  message=str(e)
  allowed=("redirect refused","fetch failed","1Password credential resolution failed","OpenAPI baseline","OpenAPI schema hash changed","invalid ","catalog reconciliation blocked","--apply requires")
  report["errors"].append(message if message.startswith(allowed) else "check failed")
  code=2
 atomic_write(a.output,report);print(json.dumps({"errors":report["errors"],"changes":report.get("changes",{})}));return code
if __name__=="__main__":raise SystemExit(main())
