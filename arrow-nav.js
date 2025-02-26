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
    const midAngle = getAngle(middleA, middleB);

    // Check for overlap
    if (areAlignedVertically && areAlignedHorizontally) {
      return {
        distance: 0,
        areAligned: true,
        midAngle,
        // Not sure what the minAngle should be here, but for the rest of the
        // code just using angle here is OK.
        minAngle: midAngle,
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
        midAngle,
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
        midAngle,
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
      midAngle,
      // Like above, not sure what the minAngle should be here, but angle works
      // with the rest of the code just fine, but we might want to consider
      // actually calculating the angle of the shortest line between the two
      // rects.
      minAngle: midAngle,
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

  const getFocusableElements = () => {
    return Array.from(document.querySelectorAll(
      'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex], [contenteditable], audio[controls], video[controls], summary'
    )).filter(el => !el.hasAttribute('tabindex') || el.tabIndex >= 0);
  };

  /**
   * @param {Number} moveAngle
  */
  const moveFocus = (moveAngle) => {
    const currentElement = document.activeElement;
    const focusableElements = getFocusableElements();
    if (focusableElements.length === 0) return;
    if (!currentElement) {
      focusableElements[0].focus();
      return;
    }

    const curRect = currentElement.getBoundingClientRect();

    const elements = focusableElements
      // Remove the current element, as we don't want to move to that
      .filter((element) => element != currentElement)
      // Remove invisible elements
      .filter((element) => {
        return element.checkVisibility({
          contentVisibilityAuto: true,
          opacityProperty: true,
          visibilityProperty: true,
        })
      })
      // Get the distance infos for each element
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return { element, rect, ...getRectDiff(curRect, rect) };
      })
      // Remove elements that are outside the direction code
      .filter((info) => {
        const maxAngle = Math.PI / 4;
        // Use minAngle here, as midAngle might give wrong results
        const angleDiff = getAngleDiff(info.minAngle, moveAngle);
        return angleDiff <= maxAngle;
      })
      // Remove off-screen elements, but allow those that are aligned
      .filter((info) => {
        if (info.areAligned) return true;

        const allowedOffScreen = 0.2;
        const scrWidth = window.innerWidth;
        const scrHeight = window.innerHeight;
        const isOffScreen =
          info.rect.right < -scrWidth * allowedOffScreen
          || info.rect.left > scrWidth + scrWidth * allowedOffScreen
          || info.rect.bottom < -scrHeight * allowedOffScreen
          || info.rect.top > scrHeight + scrHeight * allowedOffScreen;
        return !isOffScreen;
      })
      // Sort them by preferred order
      .sort((a, b) => {
        const aSmallest = -1;
        const bSmallest = 1;
        // Prefer aligned elements
        if (a.areAligned && !b.areAligned) return aSmallest;
        if (!a.areAligned && b.areAligned) return bSmallest;
        // Prefer closer elements
        if (a.distance < b.distance) return aSmallest;
        if (b.distance < a.distance) return bSmallest;
        // Prefer elements with smaller angles
        // Use mid-angle here, as the minAngle for aligned elements are often the same
        const aAngle = getAngleDiff(a.midAngle, moveAngle);
        const bAngle = getAngleDiff(a.midAngle, moveAngle);
        if (aAngle < bAngle) return aSmallest;
        if (bAngle < aAngle) return bSmallest;
        // If all is the same, they are the same
        return 0;
      });
    ;

    // Focus the first element that is willing to be focussed
    const focussed = elements.find((info) => {
      info.element.focus({
        preventScroll: true // We'll do that smoothly next
      });
      // Sometimes elements can't be focused for whatever reason, and then `focus()` just silently fails.
      // To allow this, we return wether the call succeeded, if not it'll try the next element.
      return info.element === document.activeElement;
    });
    if (focussed) {
      focussed.element.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "center",
      });
    }
  };

  /**
   * @param {string} key
  */
  const keyToAngle = (key) => {
    switch (key) {
      case 'ArrowUp':
        return Math.PI * 3 / 2;
      case 'ArrowDown':
        return Math.PI / 2;
      case 'ArrowLeft':
        return Math.PI;
      case 'ArrowRight':
        return 0;
      case 'w':
        return Math.PI * 3 / 2;
      case 's':
        return Math.PI / 2;
      case 'a':
        return Math.PI;
      case 'd':
        return 0;
      default:
        null;
    }
  };

  let lastEventTime = 0; // To slow down repeat rate, but still allow key spamming
  document.addEventListener('keydown', (event) => {
    const angle = keyToAngle(event.key);
    if (angle !== null) {
      // Limit the repeat rate
      if (Date.now() - lastEventTime > 100) {
        moveFocus(angle);
        lastEventTime = Date.now();
      }
      // Prevent default (that is scrolling),
      // as we scroll to the selected element
      event.preventDefault();
      event.stopImmediatePropagation();
    } else if (event.key == 'Backspace') {
      history.back();
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  });
  document.addEventListener('keyup', (event) => {
    const angle = keyToAngle(event.key);
    if (angle !== null) {
      // Allow spamming by resetting the time
      lastEventTime = 0;
      event.preventDefault();
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

  const highlightingId = 'highlighting-element';
  let highlightingElement = document.getElementById(highlightingId);
  if (!highlightingElement) {
    highlightingElement = document.createElement('div');
    highlightingElement.id = 'highlighting-element';
    document.body.appendChild(highlightingElement);
  }

  // The loop that animates our highlighting element to the target element
  const loop = () => {
    if (targetElement != document.activeElement) {
      prevTargetElement = targetElement;
      targetElement = document.activeElement;
      targetChangeTime = Date.now();
    }

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
})();
