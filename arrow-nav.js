(() => {
  /**
   * Code to make arrow keys navigate between focusable elements.
   */

  /**
   * @typedef {Object} Point
   * @property {number} x
   * @property {number} y
   */

  /** @typedef {'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight'} Direction */

  /**
   * @param {DOMRect} rectA
   * @param {DOMRect} rectB
  */
  const getRectDiff = (rectA, rectB) => {
    // Check alignment, that if wether the two elements would touch if
    // move perfectly vertically
    const areAlignedVertically = !(
      rectA.right < rectB.left ||
      rectA.left > rectB.right
    );
    const areAlignedHorizontally = !(
      rectA.bottom < rectB.top ||
      rectA.top > rectB.bottom
    );
    const middleA = getMiddle(rectA);
    const middleB = getMiddle(rectB);
    const angle = getAngle(middleA, middleB);

    // Check for overlap
    if (areAlignedVertically && areAlignedHorizontally) {
      return {
        distance: 0,
        areAligned: true,
        angle,
        // Not sure what the minAngle should be here, but for the rest of the
        // code just using angle here is OK.
        minAngle: angle,
      };
    }

    // Check for alignment
    if (areAlignedVertically) {
      return {
        distance: Math.min(
          Math.abs(rectA.top - rectB.bottom),
          Math.abs(rectA.bottom - rectB.top)
        ),
        areAligned: true,
        angle,
        minAngle: rectA.top < rectB.bottom ? Math.PI / 2 : Math.PI * 3 / 2,
      };
    }

    if (areAlignedHorizontally) {
      return {
        distance: Math.min(
          Math.abs(rectA.left - rectB.right),
          Math.abs(rectA.right - rectB.left)
        ),
        areAligned: true,
        angle,
        minAngle: rectA.left < rectB.right ? 0 : Math.PI,
      };
    }

    // If we're not aligned, we'll just return the distance between the two
    // Might be good to use the shortest distance, rather than the middle
    // but this is probably fine.
    return {
      // This isn't the real distance, there is a shorter distance between the
      // two rects. But for now this is fine and works well enough.
      distance: Math.hypot(middleA.x - middleB.x, middleA.y - middleB.y),
      areAligned: false,
      angle,
      // Like above, not sure what the minAngle should be here, but angle works
      // with the rest of the code just fine, but we might want to consider
      // actually calculating the angle of the shortest line between the two
      // rects.
      minAngle: angle,
    };
  };

  /**
   * @param {DOMRect} rect
   */
  const getMiddle = (rect) => ({
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  });

  /**
   * @param {Point} a
   * @param {Point} b
  */
  const getAngle = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);

  /**
   * @param {number} a
   * @param {number} b
  */
  const getAngleDiff = (a, b) => {
    const diff = b - a;
    const angle = Math.atan2(Math.sin(diff), Math.cos(diff));
    return Math.abs(angle);
  };

  /**
   * @param {Direction} direction
  */
  const dirToAngle = (direction) => {
    switch (direction) {
      case 'ArrowUp':
        return Math.PI * 3 / 2;
      case 'ArrowDown':
        return Math.PI / 2;
      case 'ArrowLeft':
        return Math.PI;
      case 'ArrowRight':
        return 0;
    }
  };

  const getFocusableElements = () => {
    return Array.from(document.querySelectorAll(
      'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex], [contenteditable], audio[controls], video[controls], summary'
    )).filter(el => !el.hasAttribute('tabindex') || el.tabIndex >= 0);
  };

  /**
   * @param {Direction} direction
  */
  const moveFocus = (direction) => {
    const currentElement = document.activeElement;
    const focusableElements = getFocusableElements();
    if (focusableElements.length === 0) return;
    if (!currentElement) {
      focusableElements[0].focus();
      return;
    }

    const curRect = currentElement.getBoundingClientRect();
    const wantedAngle = dirToAngle(direction);
    let targetElement = null;
    let minDistance = Infinity;
    let minAngle = Infinity;
    let minIsAligned = false;

    focusableElements.forEach((element) => {
      if (element === currentElement) return;

      // Some values we'll use later
      const rect = element.getBoundingClientRect();
      const diff = getRectDiff(curRect, rect);

      // Only consider elements that are in the direction of the arrow key
      // Use the min-angle so we don't overly-eagerly ignore elements
      const maxAngle = Math.PI / 4;
      if (getAngleDiff(diff.minAngle, wantedAngle) > maxAngle) return;

      // Some more values we'll need
      const allowedOffScreen = 0.2;
      const isOffScreen = (rect.right < -window.innerWidth * allowedOffScreen
        || rect.left > window.innerWidth * (1 + allowedOffScreen)
        || rect.bottom < -window.innerHeight * allowedOffScreen
        || rect.top > window.innerHeight * (1 + allowedOffScreen)
      );

      // Ignore elements too far off screen and not aligned
      if (!diff.areAligned && isOffScreen) return;

      // Remember closest element
      const angle = getAngleDiff(diff.angle, wantedAngle);
      // First prefer aligned elements, regardless of distance
      if (minIsAligned && !diff.areAligned) return;
      if (!minIsAligned && diff.isAligned) {
        targetElement = element;
        minDistance = diff.distance;
        minAngle = angle;
        minIsAligned = true;
        return;
      }
      // Then prefer closer elements
      if (diff.distance < minDistance) {
        targetElement = element;
        minDistance = diff.distance;
        minAngle = angle;
        minIsAligned = diff.areAligned;
        return;
      }
      // Prefer smaller angles, allow a few pixels of tolerance
      const tolerance = 5;
      if (diff.distance <= minDistance + tolerance && angle < minAngle) {
        targetElement = element;
        minDistance = Math.min(minDistance, diff.distance);
        minAngle = angle;
        minIsAligned = diff.areAligned;
        return;
      }
    });

    if (targetElement) {
      targetElement.focus();
      targetElement.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "center",
      });
    }
  };

  let lastEventTime = 0; // To slow down repeat rate, but still allow key spamming
  document.addEventListener('keydown', (event) => {
    switch (event.key) {
      case 'ArrowUp':
      case 'ArrowDown':
      case 'ArrowLeft':
      case 'ArrowRight':
        // Limit the repeat rate
        if (Date.now() - lastEventTime > 100) {
          moveFocus(event.key);
          lastEventTime = Date.now();
        }
        // Prevent default (that is scrolling),
        // as we scroll to the selected element
        event.preventDefault();
        break;
      // Allow going back with the backspace key for better keyboard navigation
      case 'Backspace':
        history.back();
        event.preventDefault();
        break;
    }
  });
  document.addEventListener('keyup', (event) => {
    switch (event.key) {
      case 'ArrowUp':
      case 'ArrowDown':
      case 'ArrowLeft':
      case 'ArrowRight':
        // Allow spamming by resetting the time
        lastEventTime = 0;
        event.preventDefault();
        break;
    }
  });
})();

(() => {
  /**
   * Highlighter for the focused element
   * Based on when the focus changes for any reason
   */

  /**
   * @param {number} a
   * @param {number} b
   * @param {number} t
  */
  const lerp = (a, b, t) => a + (b - a) * t;

  /**
   * @param {number} t
  */
  const ease = (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

  /**
   * @param {number} t
  */
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);

  /**
   * @param {number} x
  */
  const easeInOutElastic = (x) => {
    const c5 = (2 * Math.PI) / 4.5;

    return x === 0
      ? 0
      : x === 1
        ? 1
        : x < 0.5
          ? -(Math.pow(2, 20 * x - 10) * Math.sin((20 * x - 11.125) * c5)) / 2
          : (Math.pow(2, -20 * x + 10) * Math.sin((20 * x - 11.125) * c5)) / 2 + 1;
  }

  /**
   * @param {number} x
  */
  const easeOutBounce = (x) => {
    const n1 = 7.5625;
    const d1 = 2.75;

    if (x < 1 / d1) {
      return n1 * x * x;
    } else if (x < 2 / d1) {
      return n1 * (x -= 1.5 / d1) * x + 0.75;
    } else if (x < 2.5 / d1) {
      return n1 * (x -= 2.25 / d1) * x + 0.9375;
    } else {
      return n1 * (x -= 2.625 / d1) * x + 0.984375;
    }
  }

  /**
   * @param {number} x
  */
  const easeInOutBounce = (x) => {
    return x < 0.5
      ? (1 - easeOutBounce(1 - 2 * x)) / 2
      : (1 + easeOutBounce(2 * x - 1)) / 2;
  }

  /**
   * @param {number} pt
  */
  function ptToPx(pt) {
    return pt * (96 / 72);
  }

  /**
   * This function gives us the rect of the element where the highlighting
   * should move to. If no element is selected we'll want to animate to outside
   * the screen, so return a rect outside the screen.
   * @param {HTMLElement | null} element
   * @returns {{x: number, y: number, width: number, height: number}}
  */
  const getRect = (element) => {
    if (element === null) {
      const offset = 100;
      return {
        x: -offset,
        y: -offset,
        width: window.screen.width + offset * 2,
        height: window.screen.height + offset * 2,
      }
    }

    return element.getBoundingClientRect();
  };

  /**
   * This function gives us the border radius of the element.
   * It corrects for when the radius is set super big to create nice circles
   * @param {HTMLElement | null} element
  */
  const getBorderRadius = (element) => {
    if (element === null) {
      return {
        topLeft: 0,
        topRight: 0,
        bottomLeft: 0,
        bottomRight: 0,
      };
    }

    const styles = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    const max = Math.max(rect.height, rect.width);
    // We currently only support uniform scaling
    const scale = rect.width / element.offsetWidth;
    return {
      topLeft: Math.min(max, scale * parseFloat(styles.borderTopLeftRadius)),
      topRight: Math.min(max, scale * parseFloat(styles.borderTopRightRadius)),
      bottomLeft: Math.min(max, scale * parseFloat(styles.borderBottomLeftRadius)),
      bottomRight: Math.min(max, scale * parseFloat(styles.borderBottomRightRadius)),
    };
  };

  // Create our highlighting element
  /** @type {HTMLElement | null} */
  let targetElement = null;
  /** @type {HTMLElement | null} */
  let prevTargetElement = null;
  let targetChangeTime = Date.now();
  const highlightingElement = document.createElement('div');
  highlightingElement.id = 'highlighting-element';
  document.body.appendChild(highlightingElement);

  // The loop that animates our highlighting element to the target element
  const loop = () => {
    const animationTime = 300;
    const lerpPos = easeOut(Math.min(1, (Date.now() - targetChangeTime) / animationTime));

    //  Positioning
    const targetRect = getRect(targetElement);
    const prevRect = getRect(prevTargetElement);
    highlightingElement.style.top = lerp(prevRect.y, targetRect.y, lerpPos) + 'px';
    highlightingElement.style.left = lerp(prevRect.x, targetRect.x, lerpPos) + 'px';
    highlightingElement.style.width = lerp(prevRect.width, targetRect.width, lerpPos) + 'px';
    highlightingElement.style.height = lerp(prevRect.height, targetRect.height, lerpPos) + 'px';

    // Border radius
    const prevRadius = getBorderRadius(prevTargetElement);
    const targetRadius = getBorderRadius(targetElement);
    highlightingElement.style.borderTopLeftRadius = lerp(prevRadius.topLeft, targetRadius.topLeft, lerpPos) + 'px';
    highlightingElement.style.borderTopRightRadius = lerp(prevRadius.topRight, targetRadius.topRight, lerpPos) + 'px';
    highlightingElement.style.borderBottomLeftRadius = lerp(prevRadius.bottomLeft, targetRadius.bottomLeft, lerpPos) + 'px';
    highlightingElement.style.borderBottomRightRadius = lerp(prevRadius.bottomRight, targetRadius.bottomRight, lerpPos) + 'px';

    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  // Listen to the relevant events
  document.addEventListener("focusout", (event) => {
    prevTargetElement = event.target;
    targetElement = null;
    targetChangeTime = Date.now();
  });

  document.addEventListener("focusin", (event) => {
    // Don't use `prevTargetElement = targetElement` here as the focusout event
    // will have changes those values and we want to overwrite that here
    prevTargetElement = event.relatedTarget;
    targetElement = event.target;
    targetChangeTime = Date.now();
  });
})();
