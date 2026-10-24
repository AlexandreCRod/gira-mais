// Gira+ Multi: a press-and-hold action. The click that ends a hold is swallowed, so holding an element that also
// reacts to taps (an account row switches on tap) doesn't do both.
const HOLD_MS = 500;
/** A finger that moves this far is scrolling, not holding. */
const MOVE_TOLERANCE_PX = 10;

export function hold(node: HTMLElement, onHold: () => void) {
	let timer: ReturnType<typeof setTimeout> | undefined;
	let start: { x: number, y: number } | null = null;
	let held = false;

	const cancel = () => {
		clearTimeout(timer);
		timer = undefined;
		start = null;
	};
	const down = (event: PointerEvent) => {
		cancel();
		held = false;
		start = { x: event.clientX, y: event.clientY };
		timer = setTimeout(() => {
			timer = undefined;
			held = true;
			onHold();
		}, HOLD_MS);
	};
	const move = (event: PointerEvent) => {
		if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > MOVE_TOLERANCE_PX) cancel();
	};
	const click = (event: MouseEvent) => {
		if (!held) return;
		held = false;
		event.preventDefault();
		event.stopImmediatePropagation();
	};
	// Android's own long-press menu (text selection) would otherwise open as well
	const contextMenu = (event: Event) => event.preventDefault();

	const listeners: [string, EventListener, boolean?][] = [
		['pointerdown', down as EventListener],
		['pointermove', move as EventListener],
		['pointerup', cancel],
		['pointercancel', cancel],
		['pointerleave', cancel],
		['click', click as EventListener, true],
		['contextmenu', contextMenu],
	];
	for (const [type, listener, capture] of listeners) node.addEventListener(type, listener, capture);

	return {
		update(next: () => void) {
			onHold = next;
		},
		destroy() {
			cancel();
			for (const [type, listener, capture] of listeners) node.removeEventListener(type, listener, capture);
		},
	};
}