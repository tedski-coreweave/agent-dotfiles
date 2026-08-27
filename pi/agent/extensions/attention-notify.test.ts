import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { afterEach, describe, it } from "node:test";

import attentionNotify, {
  appleScriptString,
  compactNotificationText,
  isGhostty,
  isITerm2,
  supportsFocusReporting,
  terminalNotificationString,
} from "./attention-notify.ts";

type EventHandler = (event: unknown, ctx: FakeContext) => Promise<void> | void;
type CommandHandler = (args: string, ctx: FakeContext) => Promise<void> | void;

interface FakeContext {
  cwd: string;
  hasPendingMessages(): boolean;
  hasUI: boolean;
  isIdle(): boolean;
  mode: "tui" | "json";
  ui: { notify(message: string, level: "info" | "warning"): void };
}

class FakeStream extends EventEmitter {
  isTTY = true;
  readonly writes: string[] = [];

  write(value: string): boolean {
    this.writes.push(value);
    return true;
  }
}

const originalPlatform = Object.getOwnPropertyDescriptor(process, "platform")!;
const originalStdout = Object.getOwnPropertyDescriptor(process, "stdout")!;
const originalStdin = Object.getOwnPropertyDescriptor(process, "stdin")!;
const originalSetTimeout = globalThis.setTimeout;
const originalClearTimeout = globalThis.clearTimeout;
const originalDateNow = Date.now;
const originalEnv = { ...process.env };

function restoreGlobals(): void {
  Object.defineProperty(process, "platform", originalPlatform);
  Object.defineProperty(process, "stdout", originalStdout);
  Object.defineProperty(process, "stdin", originalStdin);
  globalThis.setTimeout = originalSetTimeout;
  globalThis.clearTimeout = originalClearTimeout;
  Date.now = originalDateNow;
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, originalEnv);
}

afterEach(restoreGlobals);

function setEnvironment(values: Record<string, string | undefined>): void {
  for (const key of ["TERM_PROGRAM", "ITERM_SESSION_ID", "GHOSTTY_RESOURCES_DIR"]) {
    delete process.env[key];
  }
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) process.env[key] = value;
  }
}

function installFakeTerminal(): { stdin: FakeStream; stdout: FakeStream } {
  const stdin = new FakeStream();
  const stdout = new FakeStream();
  Object.defineProperty(process, "stdin", { configurable: true, value: stdin });
  Object.defineProperty(process, "stdout", { configurable: true, value: stdout });
  return { stdin, stdout };
}

function registerExtension(): {
  commands: Map<string, CommandHandler>;
  handlers: Map<string, EventHandler>;
} {
  const handlers = new Map<string, EventHandler>();
  const commands = new Map<string, CommandHandler>();
  attentionNotify({
    on(event: string, handler: EventHandler) {
      handlers.set(event, handler);
    },
    registerCommand(name: string, command: { handler: CommandHandler }) {
      commands.set(name, command.handler);
    },
  } as never);
  return { commands, handlers };
}

function context(overrides: Partial<FakeContext> = {}): FakeContext {
  return {
    cwd: "/tmp/project",
    hasPendingMessages: () => false,
    hasUI: true,
    isIdle: () => true,
    mode: "tui",
    ui: { notify() {} },
    ...overrides,
  };
}

describe("notification formatting", { concurrency: false }, () => {
  it("compacts whitespace and preserves the length limit", () => {
    assert.equal(compactNotificationText("  a\n b\t c  "), "a b c");
    assert.equal(compactNotificationText("abcdef", 4), "abc…");
  });

  it("strips terminal controls but leaves ordinary text intact", () => {
    assert.equal(terminalNotificationString("title\x07\x1b]9;body"), "title  ]9;body");
    assert.equal(terminalNotificationString("title\x9dunsafe\x9cbody"), "title unsafe body");
    assert.equal(terminalNotificationString("safe text"), "safe text");
  });

  it("quotes AppleScript string values", () => {
    assert.equal(appleScriptString('say "hello" \\ again'), '"say \\"hello\\" \\\\ again"');
  });

  it("recognizes terminal capabilities", () => {
    setEnvironment({ TERM_PROGRAM: "ghostty" });
    assert.equal(isGhostty(), true);
    assert.equal(isITerm2(), false);
    assert.equal(supportsFocusReporting(), true);

    setEnvironment({ ITERM_SESSION_ID: "session" });
    assert.equal(isGhostty(), false);
    assert.equal(isITerm2(), true);
    assert.equal(supportsFocusReporting(), true);
  });
});

describe("attention lifecycle", { concurrency: false }, () => {
  it("suppresses a focused terminal, then notifies after focus leaves", async () => {
    Object.defineProperty(process, "platform", { configurable: true, value: "darwin" });
    setEnvironment({ TERM_PROGRAM: "ghostty", ITERM_SESSION_ID: "also-iterm" });
    const { stdin, stdout } = installFakeTerminal();
    const scheduled: Array<{ callback: () => void; delay: number }> = [];
    globalThis.setTimeout = ((callback: () => void, delay: number) => {
      scheduled.push({ callback, delay });
      return { unref() {} };
    }) as typeof setTimeout;
    globalThis.clearTimeout = (() => {}) as typeof clearTimeout;

    const { handlers } = registerExtension();
    const ctx = context();
    await handlers.get("session_start")!(undefined, ctx);
    assert.deepEqual(stdout.writes, ["\x1b[?1004h"]);

    await handlers.get("agent_end")!(undefined, ctx);
    assert.equal(scheduled[0]?.delay, 750);
    scheduled.shift()!.callback();
    assert.equal(stdout.writes.length, 1);

    stdin.emit("data", Buffer.from("\x1b[O"));
    await handlers.get("agent_end")!(undefined, ctx);
    assert.equal(scheduled[0]?.delay, 750);
    scheduled.shift()!.callback();
    assert.deepEqual(stdout.writes, [
      "\x1b[?1004h",
      "\x1b]6;1;bg;red;brightness;255\x07\x1b]6;1;bg;green;brightness;180\x07\x1b]6;1;bg;blue;brightness;0\x07",
      "\x1b]777;notify;pi needs attention: project;The agent is done and ready for input.\x07",
    ]);
  });

  it("throttles notifications and skips sessions without a usable UI", async () => {
    setEnvironment({ TERM_PROGRAM: "ghostty" });
    const { stdout } = installFakeTerminal();
    const scheduled: Array<{ callback: () => void; delay: number }> = [];
    globalThis.setTimeout = ((callback: () => void, delay: number) => {
      scheduled.push({ callback, delay });
      return { unref() {} };
    }) as typeof setTimeout;
    globalThis.clearTimeout = (() => {}) as typeof clearTimeout;
    Date.now = () => 5_000;

    const { handlers } = registerExtension();
    const hidden = context({ hasUI: false });
    Object.defineProperty(process, "platform", { configurable: true, value: "linux" });
    await handlers.get("agent_end")!(undefined, context());
    await handlers.get("agent_end")!(undefined, hidden);
    assert.equal(scheduled.length, 0);

    Object.defineProperty(process, "platform", { configurable: true, value: "darwin" });
    const ctx = context();
    await handlers.get("agent_end")!(undefined, ctx);
    const first = scheduled.shift()!;
    assert.equal(first.delay, 750);
    first.callback();
    await handlers.get("agent_end")!(undefined, ctx);
    const second = scheduled.shift()!;
    assert.equal(second.delay, 750);
    second.callback();
    assert.equal(stdout.writes.length, 1);
  });

  it("skips non-idle work and cancels pending notifications on lifecycle changes", async () => {
    Object.defineProperty(process, "platform", { configurable: true, value: "darwin" });
    setEnvironment({ TERM_PROGRAM: "ghostty" });
    const { stdout } = installFakeTerminal();
    const scheduled: Array<{ callback: () => void; handle: object }> = [];
    const cleared = new Set<object>();
    globalThis.setTimeout = ((callback: () => void) => {
      const handle = { unref() {} };
      scheduled.push({ callback, handle });
      return handle;
    }) as typeof setTimeout;
    globalThis.clearTimeout = ((handle: object) => { cleared.add(handle); }) as typeof clearTimeout;

    const { handlers } = registerExtension();
    const ctx = context();
    await handlers.get("session_start")!(undefined, ctx);
    await handlers.get("agent_end")!(undefined, context({ isIdle: () => false }));
    scheduled.shift()!.callback();
    await handlers.get("agent_end")!(undefined, context({ hasPendingMessages: () => true }));
    scheduled.shift()!.callback();
    assert.deepEqual(stdout.writes, ["\x1b[?1004h"]);

    await handlers.get("agent_end")!(undefined, ctx);
    const pending = scheduled.shift()!;
    await handlers.get("agent_start")!(undefined, ctx);
    assert.equal(cleared.has(pending.handle), true);
    await handlers.get("session_shutdown")!(undefined, ctx);
    assert.deepEqual(stdout.writes, ["\x1b[?1004h", "\x1b[?1004l"]);
  });

  it("resets iTerm tab color through the command after setting it", async () => {
    Object.defineProperty(process, "platform", { configurable: true, value: "linux" });
    setEnvironment({ TERM_PROGRAM: "iTerm.app" });
    const { stdout } = installFakeTerminal();
    const messages: Array<[string, string]> = [];
    const { commands } = registerExtension();
    const ctx = context({ ui: { notify(message, level) { messages.push([message, level]); } } });
    await commands.get("notify-test")!("", ctx);
    await commands.get("notify-test")!("reset", ctx);

    assert.deepEqual(stdout.writes, [
      "\x1b]6;1;bg;red;brightness;255\x07\x1b]6;1;bg;green;brightness;180\x07\x1b]6;1;bg;blue;brightness;0\x07",
      "\x1b]9;pi needs attention, project: Notifications are working.\x07",
      "\x1b]6;1;bg;*;default\x07",
    ]);
    assert.deepEqual(messages, [
      ["Sent test notification via iterm2; /notify-test reset clears the tab color", "info"],
      ["Reset tab color", "info"],
    ]);
  });
});
