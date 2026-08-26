/**
 * attention-notify — desktop/terminal notification when the agent needs input.
 *
 * Adapted from Brian Lalor's macos-notify extension
 * (https://github.com/blalor/pi-dot-dev). Changes for this harness:
 * Ghostty support via OSC 777, focus-gated notifications (only notify when
 * the terminal is unfocused, since a visible prompt needs no ping), and the
 * iTerm2 OSC 9 / tab-color paths kept for compatibility.
 *
 * The motivating incident: a permission prompt timed out unanswered because
 * nobody was looking at the terminal.
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { execFile } from "node:child_process";
import { basename } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const NOTIFICATION_DELAY_MS = 750;
const MIN_NOTIFICATION_INTERVAL_MS = 2_000;
const ITERM2_TAB_ATTENTION_COLOR = { red: 255, green: 180, blue: 0 } as const;
const FOCUS_IN_SEQUENCE = "\x1b[I";
const FOCUS_OUT_SEQUENCE = "\x1b[O";

type NotificationMethod = "ghostty" | "iterm2" | "macos" | "none";

function isITerm2(): boolean {
	return process.env.TERM_PROGRAM === "iTerm.app" || !!process.env.ITERM_SESSION_ID;
}

function isGhostty(): boolean {
	return process.env.TERM_PROGRAM === "ghostty" || !!process.env.GHOSTTY_RESOURCES_DIR;
}

function supportsFocusReporting(): boolean {
	// CSI ?1004 is standard; Ghostty and iTerm2 both implement it.
	return isGhostty() || isITerm2();
}

function compact(value: string, maxLength = 120): string {
	const oneLine = value.replace(/\s+/g, " ").trim();
	return oneLine.length > maxLength ? `${oneLine.slice(0, maxLength - 1)}…` : oneLine;
}

function terminalNotificationString(value: string): string {
	// OSC strings are terminated with BEL/ST. Strip terminal control characters
	// so notification text cannot accidentally terminate the escape sequence.
	// Also strip ';' from OSC 777 fields, which uses it as a delimiter.
	return compact(value, 180).replace(/[\x00-\x1f\x7f\x9b]/g, " ");
}

function appleScriptString(value: string): string {
	return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function writeSequence(sequence: string): boolean {
	if (!process.stdout.isTTY) return false;
	process.stdout.write(sequence);
	return true;
}

function notifyGhostty(title: string, body: string): boolean {
	if (!isGhostty()) return false;
	// Ghostty implements the rxvt OSC 777 notify extension. Fields are
	// ';'-delimited, so scrub the delimiter from free text.
	const t = terminalNotificationString(title).replace(/;/g, ",");
	const b = terminalNotificationString(body).replace(/;/g, ",");
	return writeSequence(`\x1b]777;notify;${t};${b}\x07`);
}

function notifyITerm2(message: string): boolean {
	if (!isITerm2()) return false;
	// iTerm2 OSC 9 posts a native notification associated with the session that
	// emitted it. Clicking the notification focuses that originating tab/pane.
	return writeSequence(`\x1b]9;${terminalNotificationString(message)}\x07`);
}

function setITerm2TabColor(color: { red: number; green: number; blue: number }): boolean {
	if (!isITerm2()) return false;
	return writeSequence(
		`\x1b]6;1;bg;red;brightness;${color.red}\x07` +
			`\x1b]6;1;bg;green;brightness;${color.green}\x07` +
			`\x1b]6;1;bg;blue;brightness;${color.blue}\x07`,
	);
}

function resetITerm2TabColor(): boolean {
	if (!isITerm2()) return false;
	return writeSequence("\x1b]6;1;bg;*;default\x07");
}

function enableTerminalFocusReporting(): boolean {
	if (!supportsFocusReporting()) return false;
	return writeSequence("\x1b[?1004h");
}

function disableTerminalFocusReporting(): boolean {
	if (!supportsFocusReporting()) return false;
	return writeSequence("\x1b[?1004l");
}

async function notifyMacOS(title: string, body: string, subtitle?: string): Promise<boolean> {
	if (process.platform !== "darwin") return false;

	const parts = [
		`display notification ${appleScriptString(compact(body, 220))}`,
		`with title ${appleScriptString(compact(title, 80))}`,
	];

	if (subtitle) {
		parts.push(`subtitle ${appleScriptString(compact(subtitle, 80))}`);
	}

	parts.push('sound name "Glass"');

	try {
		await execFileAsync("osascript", ["-e", parts.join(" ")]);
		return true;
	} catch {
		// Notifications are best-effort. Keep pi running if macOS notification
		// permissions are missing or osascript is unavailable.
		return false;
	}
}

async function notifyAttention(project: string, test = false): Promise<NotificationMethod> {
	const body = test ? "Notifications are working." : "The agent is done and ready for input.";

	if (notifyGhostty(`pi needs attention: ${project}`, body)) {
		return "ghostty";
	}

	if (notifyITerm2(`pi needs attention, ${project}: ${body}`)) {
		return "iterm2";
	}

	if (await notifyMacOS("pi needs attention", body, project)) {
		return "macos";
	}

	return "none";
}

export default function (pi: ExtensionAPI) {
	let lastNotificationAt = 0;
	let terminalFocused = true;
	let tabColorState: "default" | "attention" = "default";
	let focusReportingEnabled = false;
	let focusListener: ((chunk: Buffer | string) => void) | undefined;
	const pendingTimers = new Set<NodeJS.Timeout>();

	function clearPendingTimers(): void {
		for (const timer of pendingTimers) clearTimeout(timer);
		pendingTimers.clear();
	}

	function setAttentionTabColor(): void {
		if (tabColorState === "attention" || terminalFocused) return;
		if (setITerm2TabColor(ITERM2_TAB_ATTENTION_COLOR)) tabColorState = "attention";
	}

	function resetTabColor(): void {
		if (tabColorState === "default") return;
		if (resetITerm2TabColor()) tabColorState = "default";
	}

	function installFocusListener(): void {
		if (focusListener || !supportsFocusReporting() || !process.stdin.isTTY || !process.stdout.isTTY) {
			return;
		}

		focusListener = (chunk: Buffer | string) => {
			const text = chunk.toString("utf8");
			const focusInIndex = text.lastIndexOf(FOCUS_IN_SEQUENCE);
			const focusOutIndex = text.lastIndexOf(FOCUS_OUT_SEQUENCE);

			if (focusInIndex > focusOutIndex) {
				terminalFocused = true;
				resetTabColor();
			} else if (focusOutIndex > focusInIndex) {
				terminalFocused = false;
			}
		};

		process.stdin.on("data", focusListener);
		focusReportingEnabled = enableTerminalFocusReporting();
	}

	function uninstallFocusListener(): void {
		if (focusListener) {
			process.stdin.off("data", focusListener);
			focusListener = undefined;
		}
		if (focusReportingEnabled) {
			disableTerminalFocusReporting();
			focusReportingEnabled = false;
		}
	}

	function scheduleAttentionNotification(ctx: ExtensionContext): void {
		if (process.platform !== "darwin" || !ctx.hasUI) return;

		const timer = setTimeout(() => {
			pendingTimers.delete(timer);

			if (!ctx.isIdle() || ctx.hasPendingMessages()) return;

			// The whole point: a prompt someone is already looking at needs no
			// ping. Only skip when focus tracking is actually working.
			if (focusReportingEnabled && terminalFocused) return;

			setAttentionTabColor();

			const now = Date.now();
			if (now - lastNotificationAt < MIN_NOTIFICATION_INTERVAL_MS) return;
			lastNotificationAt = now;

			const project = basename(ctx.cwd) || ctx.cwd;
			void notifyAttention(project);
		}, NOTIFICATION_DELAY_MS);

		timer.unref?.();
		pendingTimers.add(timer);
	}

	pi.on("session_start", async (_event, ctx) => {
		if (ctx.mode === "tui") installFocusListener();
	});

	pi.on("agent_start", async () => {
		clearPendingTimers();
		resetTabColor();
	});

	pi.on("agent_end", async (_event, ctx) => {
		scheduleAttentionNotification(ctx);
	});

	pi.on("session_shutdown", async () => {
		clearPendingTimers();
		resetTabColor();
		uninstallFocusListener();
	});

	pi.registerCommand("notify-test", {
		description: "Send a test attention notification (Ghostty/iTerm2/macOS)",
		handler: async (args, ctx) => {
			const action = args.trim().toLowerCase();
			if (action === "reset") {
				resetTabColor();
				ctx.ui.notify("Reset tab color", "info");
				return;
			}

			if (setITerm2TabColor(ITERM2_TAB_ATTENTION_COLOR)) tabColorState = "attention";
			const method = await notifyAttention(basename(ctx.cwd) || ctx.cwd, true);
			const message =
				method === "none"
					? "Could not send notification"
					: `Sent test notification via ${method}`;
			ctx.ui.notify(`${message}; /notify-test reset clears the tab color`, method === "none" ? "warning" : "info");
		},
	});
}
