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