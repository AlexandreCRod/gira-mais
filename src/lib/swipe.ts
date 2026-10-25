// Gira+ Multi: a swipe-down action. The finger has to travel SWIPE_PX mostly downwards; the swipe fires as soon as it
// does, and the click that ends it is swallowed, so swiping an element that also reacts to taps doesn't do both.
const SWIPE_PX = 30;
/** Less than this and it's still a tap. */
const TAP_PX = 10;

export function swipeDown(node: HTMLElement, onSwipe: () => void) {
	let start: { x: number, y: number } | null = null;
	let swiped = false;

	const down = (event: PointerEvent) => {
		start = { x: event.clientX, y: event.clientY };
		swiped = false;
	};
	const move = (event: PointerEvent) => {
		if (!start) return;
		const dx = event.clientX - start.x, dy = event.clientY - start.y;
		// Keep following the finger once it leaves the element. Only once it moves: capturing on the press would send
		// a tap's click to this element instead of the button inside it
		if (Math.hypot(dx, dy) > TAP_PX && !node.hasPointerCapture?.(event.pointerId)) node.setPointerCapture?.(event.pointerId);
		if (dy >= SWIPE_PX && dy > Math.abs(dx)) {
			start = null;
			swiped = true;
			onSwipe();
		}
	};
	const end = () => start = null;
	const click = (event: MouseEvent) => {
		if (!swiped) return;
		swiped = false;
		event.preventDefault();
		event.stopImmediatePropagation();
	};

	const listeners: [string, EventListener, boolean?][] = [
		['pointerdown', down as EventListener],
		['pointermove', move as EventListener],
		['pointerup', end],
		['pointercancel', end],
		['click', click as EventListener, true],
	];
	for (const [type, listener, capture] of listeners) node.addEventListener(type, listener, capture);
	// Without this the browser takes the vertical drag as a scroll and cancels the pointer
	node.style.touchAction = 'none';

	return {
		update(next: () => void) {
			onSwipe = next;
		},
		destroy() {
			for (const [type, listener, capture] of listeners) node.removeEventListener(type, listener, capture);
		},
	};
}

/** A sideways drag at least this long moves to the next or previous page; a shorter one springs back. */
export const SIDEWAYS_COMMIT_PX = 60;

type SidewaysHandlers = { move: (dx: number) => void, end: (dx: number) => void };

// A sideways-drag action: move() follows the finger while it's down, end() gets the final distance when it lifts (0
// if the browser takes the touch away). A drag that starts mostly vertical is left alone, so the page still scrolls.
export function swipeSideways(node: HTMLElement, handlers: SidewaysHandlers) {
	let start: { x: number, y: number } | null = null;
	let dragging = false;
	let dx = 0;

	const down = (event: PointerEvent) => {
		start = { x: event.clientX, y: event.clientY };
		dragging = false;
		dx = 0;
	};
	const move = (event: PointerEvent) => {
		if (!start) return;
		dx = event.clientX - start.x;
		const dy = event.clientY - start.y;
		if (!dragging) {
			if (Math.abs(dx) <= TAP_PX) return;
			if (Math.abs(dx) <= Math.abs(dy)) {
				start = null;
				return;
			}
			dragging = true;
			node.setPointerCapture?.(event.pointerId);
		}
		handlers.move(dx);
	};
	const finish = (cancelled: boolean) => () => {
		if (dragging) handlers.end(cancelled ? 0 : dx);
		start = null;
		dragging = false;
	};
	const up = finish(false), cancel = finish(true);

	const listeners: [string, EventListener][] = [
		['pointerdown', down as EventListener],
		['pointermove', move as EventListener],
		['pointerup', up],
		['pointercancel', cancel],
	];
	for (const [type, listener] of listeners) node.addEventListener(type, listener);
	// Vertical moves still scroll; sideways ones come here instead of going to the browser
	node.style.touchAction = 'pan-y';

	return {
		update(next: SidewaysHandlers) {
			handlers = next;
		},
		destroy() {
			for (const [type, listener] of listeners) node.removeEventListener(type, listener);
		},
	};
}