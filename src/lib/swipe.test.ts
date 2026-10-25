import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { swipeDown, swipeSideways } from './swipe';

describe('swipeDown', () => {
	let wrapper: HTMLDivElement;
	let button: HTMLButtonElement;
	let tapped: Mock<() => void>;
	let swiped: Mock<() => void>;
	let action: ReturnType<typeof swipeDown>;

	beforeEach(() => {
		wrapper = document.createElement('div');
		button = document.createElement('button');
		wrapper.append(button);
		document.body.append(wrapper);
		tapped = vi.fn<() => void>();
		swiped = vi.fn<() => void>();
		button.addEventListener('click', tapped);
		action = swipeDown(wrapper, swiped);
	});
	afterEach(() => {
		action.destroy();
		wrapper.remove();
	});

	const pointer = (type: string, x: number, y: number) => button.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, bubbles: true }));
	const drag = (dx: number, dy: number) => {
		pointer('pointerdown', 0, 0);
		pointer('pointermove', dx / 2, dy / 2);
		pointer('pointermove', dx, dy);
		pointer('pointerup', dx, dy);
		button.click();
	};

	it('a tap still reaches the button', () => {
		drag(0, 3);
		expect(swiped).not.toHaveBeenCalled();
		expect(tapped).toHaveBeenCalledOnce();
	});

	it('a swipe down opens the menu, once, and not the button', () => {
		drag(4, 60);
		expect(swiped).toHaveBeenCalledOnce();
		expect(tapped).not.toHaveBeenCalled();
	});

	it('ignores swipes that are too short, sideways or upwards', () => {
		drag(0, 20);
		drag(50, 40);
		drag(0, -60);
		expect(swiped).not.toHaveBeenCalled();
	});

	it('the next tap after a swipe works again', () => {
		drag(0, 60);
		drag(0, 0);
		expect(tapped).toHaveBeenCalledOnce();
	});
});

describe('swipeSideways', () => {
	let node: HTMLDivElement;
	let move: Mock<(dx: number) => void>;
	let end: Mock<(dx: number) => void>;
	let action: ReturnType<typeof swipeSideways>;

	beforeEach(() => {
		node = document.createElement('div');
		document.body.append(node);
		move = vi.fn<(dx: number) => void>();
		end = vi.fn<(dx: number) => void>();
		action = swipeSideways(node, { move, end });
	});
	afterEach(() => {
		action.destroy();
		node.remove();
	});

	const pointer = (type: string, x: number, y: number) => node.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y }));
	const drag = (dx: number, dy: number, last = 'pointerup') => {
		pointer('pointerdown', 0, 0);
		pointer('pointermove', dx / 2, dy / 2);
		pointer('pointermove', dx, dy);
		pointer(last, dx, dy);
	};

	it('follows a sideways drag and reports where it ended', () => {
		drag(-80, 10);
		expect(move).toHaveBeenLastCalledWith(-80);
		expect(end).toHaveBeenCalledExactlyOnceWith(-80);
	});

	it('leaves taps and mostly vertical drags alone', () => {
		drag(6, 0);
		drag(30, 60);
		expect(move).not.toHaveBeenCalled();
		expect(end).not.toHaveBeenCalled();
	});

	it('a cancelled drag ends where it started', () => {
		drag(80, 0, 'pointercancel');
		expect(end).toHaveBeenCalledExactlyOnceWith(0);
	});
});