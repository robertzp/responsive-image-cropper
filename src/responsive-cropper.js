/**
 * Responsive image cropper class
 *
 * @param {String|jQuery} element jQuery object or selector
 * @param {Object}        options Options object - see this.options definition for defaults
 * @constructor
 */
function ResponsiveCropper (element, options) {
  // region Construct

  var
    $imageElement,
    $container, $imageContainer, $selector, $selectorImageContainer, $selectorImage,
    $nwHandle, $neHandle, $seHandle, $swHandle,
    dragStartPosition, dragCurrentPosition, dragStopPosition, dragMoveStartPosition,
    previousRatio,

    self             = this,
    $window          = $(window),
    keysPressed      = {},
    isMoving         = false,
    isResizing       = false,
    hasSelection     = false,
    currentSelection = {
      x:           0,
      y:           0,
      width:       0,
      height:      0,
      pixelX:      0,
      pixelY:      0,
      pixelWidth:  0,
      pixelHeight: 0
    };

  this.options = {
    minWidth:       24,
    minHeight:      24,
    constrainRatio: undefined
  };

  // endregion Construct

  // region Private

  // region Helpers

  /**
   * Set initial CSS values for cropper elements
   */
  function setInitialCSS () {
    $container.css({
      position: 'relative'
    });

    $imageElement.css({
      display: 'block'
    });

    $selector.css({
      display:  'none',
      position: 'absolute',
      top:      0,
      left:     0,
      width:    0,
      height:   0
    });

    $selectorImageContainer.css({
      position: 'absolute',
      top:      0,
      left:     0,
      width:    '100%',
      height:   '100%',
      overflow: 'hidden'
    });
  }

  /**
   * Convert co-ordinates to be relative to the image
   *
   * @param {Number} x
   * @param {Number} y
   * @returns {{x: number, y: number}}
   */
  function getRelativePosition (x, y) {
    var imageOffset = $imageElement.offset();

    return {
      x: (x - imageOffset.left),
      y: (y - imageOffset.top)
    }
  }

  /**
   * Get constrain ratio
   *
   * @returns {*}
   */
  function getConstrainRatio () {
    if (self.options.constrainRatio === 'detect') {
      return ($imageElement.height() / $imageElement.width());
    }

    return self.options.constrainRatio;
  }

  /**
   * Update the current selection bounds size
   */
  function resizeSelector (originPoint) {
    var
      ratio     = getConstrainRatio(),
      maxWidth  = $imageElement.width(),
      maxHeight = $imageElement.height(),
      selectorOffset = $selector.offset(),
      selectorRelative = getRelativePosition(selectorOffset.left, selectorOffset.top),
      top       = dragStartPosition.y,
      left      = dragStartPosition.x,
      width     = (dragCurrentPosition.x - dragStartPosition.x),
      height    = (dragCurrentPosition.y - dragStartPosition.y);

    if (originPoint === undefined) {
      originPoint = 'southeast';
    }

    toggleMoving(true);
    toggleResizing(true);

    if (dragCurrentPosition.y < dragStartPosition.y) {
      // Current vertical position is less than the start point - size it the other way
      top    = dragCurrentPosition.y;
      height = (dragStartPosition.y - dragCurrentPosition.y);
    }

    if (dragCurrentPosition.x < dragStartPosition.x) {
      // Current horizontal position is less than the start point - size it the other way
      left  = dragCurrentPosition.x;
      width = (dragStartPosition.x - dragCurrentPosition.x);
    }

    if (dragMoveStartPosition !== undefined) {
      // Resizing using a handle - calculate dimensions based on difference between mouse and selector
      if (height > 0) {
        height = $selector.height() + (selectorRelative.y - dragCurrentPosition.y);
      } else {
        height = $selector.height() - (selectorRelative.y - dragCurrentPosition.y);
      }

      if (width > 0) {
        width = $selector.width() + (selectorRelative.x - dragCurrentPosition.x);
      } else {
        width = $selector.width() - (selectorRelative.x - dragCurrentPosition.x);
      }

      switch (originPoint) {
        case 'northwest':
          top  = dragCurrentPosition.y;
          left = dragCurrentPosition.x;
          break;

        case 'northeast':
          top   = dragCurrentPosition.y;
          left  = selectorRelative.x;
          width = dragCurrentPosition.x;
          break;

        case 'southeast':
          top    = selectorRelative.y;
          left   = selectorRelative.x;
          width  = dragCurrentPosition.x;
          height = dragCurrentPosition.y;
          break;

        case 'southwest':
          top    = selectorRelative.y;
          left   = dragCurrentPosition.x;
          height = dragCurrentPosition.y;
          break;
      }
    }

    if (keysPressed[16] === true) {
      // Shift key is pressed - constrain proportions
      if (previousRatio !== undefined) {
        // Manipulating existing selection - use ratio set by initial selection
        ratio = previousRatio;
      } else {
        // New selection - use original image ratio
        ratio = (maxHeight / maxWidth);
      }

      height = (width * ratio);
    }

    if (width < self.options.minWidth) {
      // Attempted width is smaller than the minimum - override with the minimum
      width = self.options.minWidth;
    }

    if (height < self.options.minHeight) {
      // Attempted height is smaller than the minimum - override with the minimum
      height = self.options.minHeight;
    }

    if (self.options.constrainRatio !== undefined) {
      height = (width * ratio);
    }

    self.updateSelector(top, left, width, height);
    setSelectorToBounds();
  }

  /**
   * Update the current selection bounds position
   */
  function moveSelector () {
    var
      top  = dragCurrentPosition.y,
      left = dragCurrentPosition.x;

    toggleMoving(true);

    self.updateSelector(top, left);
    setSelectorToBounds();
  }

  /**
   * Check if the current selection drag is within the bounds of the image
   *
   * @returns {boolean}
   */
  function checkIfInBounds () {
    var
      selectorOffset = $selector.offset(),
      selectorRelative = getRelativePosition(selectorOffset.left, selectorOffset.top);

    return (
      (selectorRelative.x >= 0) &&
      (selectorRelative.y >= 0) &&
      (selectorRelative.x < $imageElement.width()) &&
      (selectorRelative.y < $imageElement.height()) &&
      ((selectorRelative.x + $selector.width()) < $imageElement.width()) &&
      ((selectorRelative.y + $selector.height()) < $imageElement.height())
    );
  }

  /**
   * Set selector position back within the image bounds
   */
  function setSelectorToBounds () {
    var
      selectorOffset = $selector.offset(),
      selectorRelative = getRelativePosition(selectorOffset.left, selectorOffset.top),
      top = selectorRelative.y,
      left = selectorRelative.x;

    if (selectorRelative.y < 0) {
      // Selector is outside the top boundary
      top = 0;
    }

    if (selectorRelative.x < 0) {
      // Selector is outside the left boundary
      left = 0;
    }

    if ((selectorRelative.x + $selector.width()) > $imageElement.width()) {
      // Selector is outside the right boundary
      left = ($imageElement.width() - $selector.width());
    }

    if ((selectorRelative.y + $selector.height()) > $imageElement.height()) {
      // Selector is outside the bottom boundary
      top = ($imageElement.height() - $selector.height());
    }

    self.updateSelector(top, left);
  }

  /**
   * Set current ratio as the 'previous ratio' for future shift+drag calls
   */
  function setPreviousRatio () {
    previousRatio = ($selector.height() / $selector.width());
  }

  /**
   * Toggle selector moving state
   *
   * @param {Boolean} value
   */
  function toggleMoving (value) {
    if (value === undefined) {
      value = (!isMoving);
    }

    isMoving = value;
    $container.toggleClass('gomedia-crop-moving', value);
  }

  /**
   * Toggle selector resizing state
   *
   * @param {Boolean} value
   */
  function toggleResizing (value) {
    if (value === undefined) {
      value = (!isResizing);
    }

    isResizing = value;
    $container.toggleClass('gomedia-crop-resizing', value);
  }

  /**
   * Toggle hasSelection state
   *
   * @param {Boolean} value
   */
  function toggleHasSelection (value) {
    if (value === undefined) {
      value = (!hasSelection);
    }

    hasSelection = value;
    $container.toggleClass('gomedia-crop-has-selection', value);
  }

  // endregion Helpers

  // region Builders

  /**
   * Build crop widget elements
   */
  function buildCropWidget () {
    $container              = $('<div class="gomedia-crop-container"></div>');
    $imageContainer         = $('<div class="gomedia-crop-image"></div>');
    $selector               = $('<div class="gomedia-crop-selector"></div>');
    $selectorImageContainer = $('<div class="gomedia-crop-selector-image"></div>');

    $nwHandle = $('<div class="gomedia-crop-handle gomedia-crop-handle-nw"></div>');
    $neHandle = $('<div class="gomedia-crop-handle gomedia-crop-handle-ne"></div>');
    $seHandle = $('<div class="gomedia-crop-handle gomedia-crop-handle-se"></div>');
    $swHandle = $('<div class="gomedia-crop-handle gomedia-crop-handle-sw"></div>');

    $container
      .append($imageContainer)
      .append($selector);

    $selectorImage = $imageElement.clone();
    $selectorImage.removeAttr('id');
    $selectorImageContainer.append($selectorImage);

    $selector
      .append($selectorImageContainer)
      .append($nwHandle)
      .append($neHandle)
      .append($seHandle)
      .append($swHandle);

    $imageElement.before($container);
    $imageContainer.append($imageElement);

    setInitialCSS();
  }

  // endregion Builders

  // region Event handlers

  // region Selector events

  /**
   * Handle selector mouse drag event
   *
   * @param evt
   */
  function handleSelectorMouseDrag (evt) {
    var
      mouseRelative          = getRelativePosition(evt.pageX, evt.pageY),
      selectorMoveDifference = {
        x: (mouseRelative.x - dragMoveStartPosition.x),
        y: (mouseRelative.y - dragMoveStartPosition.y)
      };

    dragCurrentPosition = {
      x: (dragStartPosition.x + selectorMoveDifference.x),
      y: (dragStartPosition.y + selectorMoveDifference.y)
    };

    if (selectorMoveDifference.x < 0) {
      dragCurrentPosition.x = (dragStartPosition.x - Math.abs(selectorMoveDifference.x));
    }

    if (dragCurrentPosition.y < 0) {
      dragCurrentPosition.y = (dragStartPosition.y - Math.abs(selectorMoveDifference.y));
    }

    moveSelector();
  }

  /**
   * Handle selector mousedown event
   *
   * @param evt
   */
  function handleSelectorMouseDown (evt) {
    if (evt.which !== 1) {
      // Not the left click - don't do anything
      return;
    }

    var selectorOffset = $selector.offset();

    dragStopPosition      = undefined;
    dragCurrentPosition   = undefined;
    dragMoveStartPosition = getRelativePosition(evt.pageX, evt.pageY);
    dragStartPosition     = getRelativePosition(selectorOffset.left, selectorOffset.top);

    $imageElement
      .on('mousemove', handleSelectorMouseDrag)
      .on('mouseup', handleSelectorMouseUp);
    $selector
      .on('mousemove', handleSelectorMouseDrag)
      .on('mouseup', handleSelectorMouseUp);
  }

  /**
   * Handle selector mouseup event
   *
   * @param evt
   */
  function handleSelectorMouseUp (evt) {
    toggleMoving(false);
    toggleResizing(false);

    $imageElement
      .off('mousemove', handleSelectorMouseDrag)
      .off('mouseup', handleSelectorMouseUp);
    $selector
      .off('mousemove', handleSelectorMouseDrag)
      .off('mouseup', handleSelectorMouseUp);
  }

  /**
   * Handle selector image mousedown event
   *
   * @param evt
   */
  function handleSelectorImageMouseDown (evt) {
    evt.preventDefault();
  }

  // endregion Selector events

  // region Selector handle events

  // region Generic

  /**
   * Handle selector handle mouseup event
   *
   * @param evt
   */
  function handleSelectorHandleMouseUp (evt) {
    toggleMoving(false);
    toggleResizing(false);

    $imageElement.off('mousemove mouseup');
    $selector.off('mousemove mouseup');
  }

  // endregion Generic

  // region Northwest

  /**
   * Handle northwest selector handle mousedown event
   *
   * @param evt
   */
  function handleSelectorNwHandleMouseDown (evt) {
    evt.stopPropagation();
    evt.preventDefault();

    if (evt.which !== 1) {
      // Not the left click - don't do anything
      return;
    }

    var selectorOffset = $selector.offset();

    dragStopPosition      = undefined;
    dragCurrentPosition   = undefined;
    dragMoveStartPosition = getRelativePosition(evt.pageX, evt.pageY);
    dragStartPosition     = getRelativePosition(selectorOffset.left, selectorOffset.top);

    $imageElement
      .on('mousemove', handleSelectorNwHandleMouseDrag)
      .on('mouseup', handleSelectorHandleMouseUp);
    $selector
      .on('mousemove', handleSelectorNwHandleMouseDrag)
      .on('mouseup', handleSelectorHandleMouseUp);
  }

  /**
   * Handle northwest selector handle mouse drag event
   *
   * @param evt
   */
  function handleSelectorNwHandleMouseDrag (evt) {
    var
      mouseRelative          = getRelativePosition(evt.pageX, evt.pageY),
      selectorMoveDifference = {
        x: (mouseRelative.x - dragMoveStartPosition.x),
        y: (mouseRelative.y - dragMoveStartPosition.y)
      };

    dragCurrentPosition = {
      x: (dragStartPosition.x + selectorMoveDifference.x),
      y: (dragStartPosition.y + selectorMoveDifference.y)
    };

    if (selectorMoveDifference.x < 0) {
      dragCurrentPosition.x = (dragStartPosition.x - Math.abs(selectorMoveDifference.x));
    }

    if (dragCurrentPosition.y < 0) {
      dragCurrentPosition.y = (dragStartPosition.y - Math.abs(selectorMoveDifference.y));
    }

    resizeSelector('northwest');

    if (checkIfInBounds() !== true) {
      // Currently out of image bounds - trigger the mouseup event handler to 'finish' the drag
      handleSelectorHandleMouseUp(evt);
    }
  }

  // endregion Northwest

  // region Northeast

  /**
   * Handle northeast selector handle mousedown event
   *
   * @param evt
   */
  function handleSelectorNeHandleMouseDown (evt) {
    evt.stopPropagation();
    evt.preventDefault();

    if (evt.which !== 1) {
      // Not the left click - don't do anything
      return;
    }

    var selectorOffset = $selector.offset();

    dragStopPosition      = undefined;
    dragCurrentPosition   = undefined;
    dragMoveStartPosition = getRelativePosition(evt.pageX, evt.pageY);
    dragStartPosition     = getRelativePosition($selector.width(), selectorOffset.top);

    $imageElement
      .on('mousemove', handleSelectorNeHandleMouseDrag)
      .on('mouseup', handleSelectorHandleMouseUp);
    $selector
      .on('mousemove', handleSelectorNeHandleMouseDrag)
      .on('mouseup', handleSelectorHandleMouseUp);
  }

  /**
   * Handle northeast selector handle mouse drag event
   *
   * @param evt
   */
  function handleSelectorNeHandleMouseDrag (evt) {
    var
      mouseRelative          = getRelativePosition(evt.pageX, evt.pageY),
      selectorMoveDifference = {
        x: (mouseRelative.x - dragMoveStartPosition.x),
        y: (mouseRelative.y - dragMoveStartPosition.y)
      };

    dragCurrentPosition = {
      x: (dragStartPosition.x + selectorMoveDifference.x),
      y: (dragStartPosition.y + selectorMoveDifference.y)
    };

    if (selectorMoveDifference.x < 0) {
      dragCurrentPosition.x = (dragStartPosition.x - Math.abs(selectorMoveDifference.x));
    }

    if (dragCurrentPosition.y < 0) {
      dragCurrentPosition.y = (dragStartPosition.y - Math.abs(selectorMoveDifference.y));
    }

    resizeSelector('northeast');

    if (checkIfInBounds() !== true) {
      // Currently out of image bounds - trigger the mouseup event handler to 'finish' the drag
      handleSelectorHandleMouseUp(evt);
    }
  }

  // endregion Northeast

  // region Southeast

  /**
   * Handle southeast selector handle mousedown event
   *
   * @param evt
   */
  function handleSelectorSeHandleMouseDown (evt) {
    evt.stopPropagation();
    evt.preventDefault();

    if (evt.which !== 1) {
      // Not the left click - don't do anything
      return;
    }

    var selectorOffset = $selector.offset();

    dragStopPosition      = undefined;
    dragCurrentPosition   = undefined;
    dragMoveStartPosition = getRelativePosition(evt.pageX, evt.pageY);
    dragStartPosition     = getRelativePosition($selector.width(), selectorOffset.top);
    dragStartPosition.y   = $selector.height();

    $imageElement
      .on('mousemove', handleSelectorSeHandleMouseDrag)
      .on('mouseup', handleSelectorHandleMouseUp);
    $selector
      .on('mousemove', handleSelectorSeHandleMouseDrag)
      .on('mouseup', handleSelectorHandleMouseUp);
  }

  /**
   * Handle southeast selector handle mouse drag event
   *
   * @param evt
   */
  function handleSelectorSeHandleMouseDrag (evt) {
    var
      mouseRelative          = getRelativePosition(evt.pageX, evt.pageY),
      selectorMoveDifference = {
        x: (mouseRelative.x - dragMoveStartPosition.x),
        y: (mouseRelative.y - dragMoveStartPosition.y)
      };

    dragCurrentPosition = {
      x: (dragStartPosition.x + selectorMoveDifference.x),
      y: (dragStartPosition.y + selectorMoveDifference.y)
    };

    if (selectorMoveDifference.x < 0) {
      dragCurrentPosition.x = (dragStartPosition.x - Math.abs(selectorMoveDifference.x));
    }

    if (dragCurrentPosition.y < 0) {
      dragCurrentPosition.y = (dragStartPosition.y - Math.abs(selectorMoveDifference.y));
    }

    resizeSelector('southeast');

    if (checkIfInBounds() !== true) {
      // Currently out of image bounds - trigger the mouseup event handler to 'finish' the drag
      handleSelectorHandleMouseUp(evt);
    }
  }

  // endregion Southeast

  // region Southwest

  /**
   * Handle southeast selector handle mousedown event
   *
   * @param evt
   */
  function handleSelectorSwHandleMouseDown (evt) {
    evt.stopPropagation();
    evt.preventDefault();

    if (evt.which !== 1) {
      // Not the left click - don't do anything
      return;
    }

    var selectorOffset = $selector.offset();

    dragStopPosition      = undefined;
    dragCurrentPosition   = undefined;
    dragMoveStartPosition = getRelativePosition(evt.pageX, evt.pageY);
    dragStartPosition     = getRelativePosition(selectorOffset.left, selectorOffset.top);
    dragStartPosition.y   = $selector.height();

    $imageElement
      .on('mousemove', handleSelectorSwHandleMouseDrag)
      .on('mouseup', handleSelectorHandleMouseUp);
    $selector
      .on('mousemove', handleSelectorSwHandleMouseDrag)
      .on('mouseup', handleSelectorHandleMouseUp);
  }

  /**
   * Handle southeast selector handle mouse drag event
   *
   * @param evt
   */
  function handleSelectorSwHandleMouseDrag (evt) {
    var
      mouseRelative          = getRelativePosition(evt.pageX, evt.pageY),
      selectorMoveDifference = {
        x: (mouseRelative.x - dragMoveStartPosition.x),
        y: (mouseRelative.y - dragMoveStartPosition.y)
      };

    dragCurrentPosition = {
      x: (dragStartPosition.x + selectorMoveDifference.x),
      y: (dragStartPosition.y + selectorMoveDifference.y)
    };

    if (selectorMoveDifference.x < 0) {
      dragCurrentPosition.x = (dragStartPosition.x - Math.abs(selectorMoveDifference.x));
    }

    if (dragCurrentPosition.y < 0) {
      dragCurrentPosition.y = (dragStartPosition.y - Math.abs(selectorMoveDifference.y));
    }

    resizeSelector('southwest');

    if (checkIfInBounds() !== true) {
      // Currently out of image bounds - trigger the mouseup event handler to 'finish' the drag
      handleSelectorHandleMouseUp(evt);
    }
  }

  // endregion Southwest

  // endregion Selector handle events

  // region Crop image events

  /**
   * Handle image mouse drag event
   *
   * @param evt
   */
  function handleCropImageMouseDrag (evt) {
    dragCurrentPosition = getRelativePosition(evt.pageX, evt.pageY);

    resizeSelector();

    if (checkIfInBounds() !== true) {
      // Currently out of image bounds - trigger the mouseup event handler to 'finish' the drag
      handleCropImageMouseUp(evt);
    }
  }

  /**
   * Handle image mousedown event
   *
   * @param evt
   */
  function handleCropImageMouseDown (evt) {
    if (evt.which !== 1) {
      // Not the left click - don't do anything
      return;
    }

    // Don't drag the actual image around the page
    evt.preventDefault();

    previousRatio         = undefined;
    dragStopPosition      = undefined;
    dragCurrentPosition   = undefined;
    dragMoveStartPosition = undefined;
    dragStartPosition     = getRelativePosition(evt.pageX, evt.pageY);

    // Bind mousemove/mouseup events to elements to handle dragging the selector
    $imageElement
      .on('mousemove', handleCropImageMouseDrag)
      .on('mouseup', handleCropImageMouseUp);
    $selector
      .on('mousemove', handleCropImageMouseDrag)
      .on('mouseup', handleCropImageMouseUp);

    // Remove mousemove/mousedown handlers from selector to prevent dragging it
    $selector
      .off('mousemove', handleSelectorMouseDrag)
      .off('mousedown', handleSelectorMouseDown);
  }

  /**
   * Handle image mouseup event
   *
   * @param evt
   */
  function handleCropImageMouseUp (evt) {
    toggleMoving(false);
    toggleResizing(false);

    dragStopPosition = getRelativePosition(evt.pageX, evt.pageY);

    // Remove mousemove/mouseup handlers from elements to prevent dragging the selector
    $imageElement
      .off('mousemove', handleCropImageMouseDrag)
      .off('mouseup', handleCropImageMouseUp);
    $selector
      .off('mousemove', handleCropImageMouseDrag)
      .off('mouseup', handleCropImageMouseUp)
      .off('mousemove', handleSelectorMouseDrag)
      .on('mousedown', handleSelectorMouseDown);

    setPreviousRatio();

    if (
      (currentSelection.width <= 0) ||
      (currentSelection.height <= 0)
    ) {
      self.clearSelector();
    }
  }

  // endregion Crop image events

  // region Key events

  /**
   * Handle keydown event
   *
   * @param evt
   */
  function handleKeydown (evt) {
    keysPressed[evt.keyCode] = true;
  }

  /**
   * Handle keyup event
   *
   * @param evt
   */
  function handleKeyup (evt) {
    if (keysPressed[evt.keyCode] !== undefined) {
      delete keysPressed[evt.keyCode];
    }
  }

  // endregion Key events

  /**
   * Handle window resize event
   * @param evt
   */
  function handleWindowResize (evt) {
    if (
      (currentSelection.width === undefined) ||
      (currentSelection.width === Infinity) ||
      (currentSelection.width <= 0)
    ) {
      return;
    }

    var
      imageWidth  = $imageElement.width(),
      imageHeight = $imageElement.height();

    // Update selector responsively based on decimal values
    self.updateSelector(
      Math.round(imageHeight * currentSelection.y),
      Math.round(imageWidth * currentSelection.x),
      Math.round(imageWidth * currentSelection.width),
      Math.round(imageHeight * currentSelection.height)
    );
  }

  // endregion Event handlers

  // region Event binders

  /**
   * Bind functionality to key events
   */
  function bindKeys () {
    $window
      .on('keydown', handleKeydown)
      .on('keyup', handleKeyup);
  }

  /**
   * Bind functionality to image element events
   */
  function bindCropImage () {
    $imageElement.on('mousedown', handleCropImageMouseDown);
  }

  /**
   * Bind functionality to selector elements
   */
  function bindSelector () {
    $nwHandle.on('mousedown', handleSelectorNwHandleMouseDown);
    $neHandle.on('mousedown', handleSelectorNeHandleMouseDown);
    $seHandle.on('mousedown', handleSelectorSeHandleMouseDown);
    $swHandle.on('mousedown', handleSelectorSwHandleMouseDown);

    $selectorImage
      .off('mousedown')
      .on('mousedown', handleSelectorImageMouseDown);
  }

  /**
   * Bind functionality to window resize event
   */
  function bindWindowResize () {
    $window.on('load resize orientationchange', handleWindowResize);
  }

  // endregion Event binders

  // region Base

  /**
   * Initialise
   */
  function init () {
    $.extend(self.options, options);

    $imageElement = $(element);
    buildCropWidget();
    bindKeys();
    bindCropImage();
    bindSelector();
    bindWindowResize();
  }

  // endregion Base

  // endregion Private

  // region Public

  /**
   * Update selector dimensions
   *
   * @param {Number} top
   * @param {Number} left
   * @param {Number} width
   * @param {Number} height
   */
  this.updateSelector = function (top, left, width, height) {
    var
      imageWidth         = $imageElement.width(),
      imageHeight        = $imageElement.height(),
      imageNaturalWidth  = $imageElement[0].naturalWidth,
      imageNaturalHeight = $imageElement[0].naturalHeight;

    if (width === undefined) {
      // Width not passed - get current width
      width = $selector.width();
    }

    if (height === undefined) {
      // Height not passed - get current height
      height = $selector.height();
    }

    toggleHasSelection((width > 0) && (height > 0));

    // Update selector CSS dimensions
    $selector.css({
      display:  'block',
      position: 'absolute',
      top:      top,
      left:     left,
      width:    width,
      height:   height
    });

    // Update selector image CSS dimensions
    $selectorImage.css({
      position: 'absolute',
      top:      -top,
      left:     -left,
      width:    imageWidth,
      height:   imageHeight
    });

    // Update current selection decimal values
    currentSelection = {
      x:      (left / imageWidth),
      y:      (top / imageHeight),
      width:  (width / imageWidth),
      height: (height / imageHeight)
    };

    currentSelection.pixelX      = Math.floor(currentSelection.x * imageNaturalWidth);
    currentSelection.pixelY      = Math.floor(currentSelection.y * imageNaturalHeight);
    currentSelection.pixelWidth  = Math.floor(currentSelection.width * imageNaturalWidth);
    currentSelection.pixelHeight = Math.floor(currentSelection.height * imageNaturalHeight);
  };

  /**
   * Clear selector state
   */
  this.clearSelector = function () {
    toggleHasSelection(false);
    setInitialCSS();

    currentSelection = {
      x:           0,
      y:           0,
      width:       0,
      height:      0,
      pixelX:      0,
      pixelY:      0,
      pixelWidth:  0,
      pixelHeight: 0
    };
  };

  /**
   * Get currentSelection
   *
   * @returns {{x: number, y: number, width: number, height: number}}
   */
  this.getCurrentSelection = function () {
    return currentSelection;
  };

  // endregion Public

  // Initialise!
  init();
}