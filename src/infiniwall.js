/*!
InfiniWall v0.1.0 ~ Copyright (c) 2012 Matteo Spinelli, http://cubiq.org

Permission is hereby granted, free of charge, to any person
obtaining a copy of this software and associated documentation
files (the "Software"), to deal in the Software without
restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.
*/

(function (window, document) {

var dummyStyle = document.createElement('i').style,
	$ = function (selector) {return document.querySelector(selector)},
	vendor = (function () {
		var vendors = 't,webkitT,MozT,msT,OT'.split(','),
			t,
			i = 0,
			l = vendors.length;
		
		for ( ; i < l; i++ ) {
			t = vendors[i] + 'ransform';
			if ( t in dummyStyle )
				return vendors[i].substr(0, vendors[i].length - 1);
		}
		
		return false;
	})(),
	cssVendor = vendor ? '-' + vendor.toLowerCase() + '-' : '',

	// Style properties
	transform 			= prefixStyle('transform'),
	transformOrigin = prefixStyle('transform-origin'),
	transitionProperty = prefixStyle('transitionProperty'),
	transitionDuration = prefixStyle('transitionDuration'),
	transitionTimingFunction = prefixStyle('transitionTimingFunction'),
	transitionDelay = prefixStyle('transitionDelay'),

    // Browser capabilities
	has3d = prefixStyle('perspective') in dummyStyle,
	hasTouch = 'ontouchstart' in window,
	hasTransitionEnd = prefixStyle('transition') in dummyStyle,

	// Device detect
	isAndroid = (/android/i).test(navigator.appVersion),

	resizeEv = 'onorientationchange' in window ? 'orientationchange' : 'resize',
	startEv = hasTouch ? 	'touchstart' 	: 'mousedown',
	moveEv = hasTouch ? 	'touchmove' 	: 'mousemove',
	endEv = hasTouch ? 		'touchend' 		: 'mouseup',
	cancelEv = hasTouch ? 'touchcancel' : 'mouseup',
	transitionEndEv = (function () {
		if ( vendor === false ) return false;

		var transitionEnd = {
				''			: 'transitionend',
				'webkit': 'webkitTransitionEnd',
				'Moz'		: 'transitionend',
				'O'			: 'otransitionend',
				'ms'		: 'MSTransitionEnd'
			};

		return transitionEnd[vendor];
	})(),
	
	// Helpers
	requestFrame =	window.requestAnimationFrame ||
					window.webkitRequestAnimationFrame ||
					window.mozRequestAnimationFrame ||
					window.msRequestAnimationFrame ||
					window.oRequestAnimationFrame ||
					// fallback timeout fix
					function (callback) { return setTimeout(callback, 1000/60 ); },
	translateZ = has3d ? ' translateZ(0)' : '',
	scale = 1;
	

function InfiniWall (el, options) {
	// vars
	this.gridScaleStep = 5;

	// add defaults
	this.defaults = { 
		gridSize: 5, // grid size NxN
		maxScale: 5, // max scale size
		isPreserveMoveSizeOnScale: true,// molly yeh. When you scale smthing
																		// with a transform, all actual sizes still the same
																		// this option determines if we need to recalc
																		// move interaction on scale to make it more consistant
    isFollowMouseOnScale: false,		// 
    scaleCoeff: 					.05		  	// scale step coeff
	};
	
	this._initialize(el,options);

	// get window width
	parentComputedProp = window.getComputedStyle(this.inner, null)
	this.windowWidth 		=  parseInt(parentComputedProp['width'],10);
	this.windowHeight 	=  parseInt(parentComputedProp['height'],10);
	// wheeel handler
	this._listenToWheel('_onWheel');

	this._bind(startEv, this.container);
}



InfiniWall.prototype = {
	_initialize: function (el, options) {
			var x = 0,
			y = 0,
			pos,
			i,
			tag,
			str = '';
		// extend options by defaults
		this.options = options = this._defaults(options || {}, this.defaults);


		// change this.container if it is specified
		if (el){
			this.container = typeof el == 'string' ? document.querySelector(el) : el ;
			this.inner = document.createElement('div');
			this.inner.className = "infiniwall-inner";
			this.container.appendChild(this.inner);
			this.wall = document.createElement('ul');
			this.inner.appendChild(this.wall);
		}

		el || (console.log('reinit')) 

		this.gridSize = options.gridSize;
		var e = document.createElement('div');
		// add initial cell containers
		// if wall already has containers, sub their amount
		// needed for reinit
		var wallChildrenLength = this.wall.children.length;
		for ( x = wallChildrenLength ; x < (this.gridSize*this.gridSize); x++ ) { 
			// a lots of dom manipulations instead of one
			// to keep pinch gesture
			// [todo] optimize
			e.innerHTML = '<li data-num="'+x+'"></li>';
			this.wall.appendChild(e.firstChild);
		}

		this.cellWidth = this.wall.children[0].offsetWidth;
		this.cellHeight = this.wall.children[0].offsetHeight;

		// on first init
		if (el){
			this.container.style.width  = 3*this.cellWidth+'px';
			this.container.style.height = 3*this.cellHeight+'px';
			this.container.style.overflow = 'hidden';
			this.wall.style.top  = -this.cellHeight+'px';
			this.wall.style.left = -this.cellWidth+'px';
		}

		pos = this._getPosition();
		this.x = pos.x;
		this.y = pos.y;

		
		this.gridWidth = this.gridSize;
		this.gridHeight = this.gridSize;
		this.virtualGridWidth = 2*this.gridSize;
		this.virtualGridHeight = 2*this.gridSize;

		this.wallWidth 	= this.cellWidth * this.gridWidth;
		this.wallHeight = this.cellHeight * this.gridHeight;
		
		this.wall.style.width  =  this.wallWidth  + 'px';
		this.wall.style.height =  this.wallWidth 	+ 'px';
		this.cells = [];
		for (x=0; x < this.gridWidth; x++ ) {
			this.cells[x] = [];

			for ( y = 0; y < this.gridHeight; y++ ) {
				this.cells[x][y] = {
					el: this.wall.children[y * this.gridWidth + x],
					slot: y * this.virtualGridWidth + x,
					x: 0,
					y: 0
				};
				this.cells[x][y].prevSlot = this.cells[x][y].slot;

				if ((this.cells[x][y] != null)&&(this.cells[x][y].el.firstChild != null)) {continue;};

				this.cells[x][y].el.className = 'loading';
				tag = document.createElement('img');
				tag.onload  = imgLoaded;
				tag.onerror = imgLoaded;
				
				// add mod 100 to load all images
				tag.src = 'images/img' + (this.cells[x][y].slot % 100) + '.jpg';
				this.cells[x][y].el.appendChild(tag);

				tag = document.createElement('span');
				tag.innerHTML = 'Image No. ' + this.cells[x][y].slot;
				this.cells[x][y].el.appendChild(tag);


				// removes lots of spans

				// tag = document.createElement('span');
				// tag.className = 'spinner';
				// this.cells[x][y].el.appendChild(tag);
			}
		}

	},

	/**
	 * [_bindContext function for context binding]
	 * @param  {function} func    [source function to bind context]
	 * @param  {object}   context [new context]
	 * @return {function}         [carring function]
	 */
	_bindContext: function(func, context){
		var bindArgs = Array.prototype.slice.call(arguments,2)
		function wrapper(){
			var args = Array.prototype.slice.call(arguments);
			var unshiftArgs = bindArgs.concat(args);
			return func.apply(context, unshiftArgs);
		}
		return wrapper;
	},
	/**
	 * [_listenToWheel cross browser listen to mouse wheel launch function]
	 * @param  {string} handler  [handler name for wheel event]
	 */
	_listenToWheel:function(handler){
		// scale coeff
		this.coeff = 1;
		this.wheelTimeout = null;
		this[handler] = this._bindContext(this[handler], this)

		if (this.inner.addEventListener) {
		  if ('onwheel' in document) {
		    // IE9+, FF17+
		    this.inner.addEventListener ("wheel", this[handler], false);
		  } else if ('onmousewheel' in document) {
		    // deprecated event variant
		    this.inner.addEventListener ("mousewheel", this[handler], false);
		  } else {
		    // 3.5 <= Firefox < 17, omit older DOMMouseScroll event
		    this.inner.addEventListener ("MozMousePixelScroll", this[handler], false);
		  }
		} else { // IE<9
		  this.inner.attachEvent ("onmousewheel", this[handler]);
		}
	},
	/**
	 * [_onWheel wheel event handler]
	 * @param  {object/event} e [event]
	 */
	_onWheel:function (e) {
			if (!e.metaKey) {return true};
		
		  clearTimeout(this.wheelTimeout); var it = this;
			this.wheelTimeout = setTimeout(function () { scale = it._saveScale(); it.coeff = 1; }, 50);
		  e = e || window.event;
		  // wheelDelta doesn't allow to determine pixels quantity
		  var delta = e.deltaY || e.detail || e.wheelDelta;

			this.options.isFollowMouseOnScale && (this.inner.style[transformOrigin] = e.x +'px '+ e.y + 'px');
		  var coeff = (delta < 0) ? this.options.scaleCoeff : -this.options.scaleCoeff/3;
			this.coeff += coeff;
			this.coeff = (this.coeff <= 1/this.options.maxScale)? 1/this.options.maxScale: this.coeff;
			this.coeff = (this.coeff >= this.options.maxScale)? this.options.maxScale: this.coeff;
		  this._scale(this.coeff);
		  e.preventDefault ? e.preventDefault() : (e.returnValue = false);
	},

	// defaults extend function
	_defaults:function (options, defaults) {
		for (var key in defaults){
			(options[key] === void 0) && (options[key] = defaults[key]);
		}
		return options;
	},

	handleEvent: function (e) {
		if ((e.scale !== 1)&&(e.scale != null)){ this._scale(e.scale);}
		switch (e.type) {
			case startEv:
				if ( !hasTouch && e.button !== 0 ) return;
				this._start(e);
				break;
			case moveEv:
				this._move(e);
				break;
			case endEv:
			case cancelEv:
				this._end(e);
				break;
			case resizeEv:
				this._resize();
				break;
			case transitionEndEv:
				this._transitionEnd(e);
				break;
		}
	},

	_bind: function (type, el, bubble) {
		(el || this.scroller).addEventListener(type, this, !!bubble);
	},

	_unbind: function (type, el, bubble) {
		(el || this.scroller).removeEventListener(type, this, !!bubble);
	},

	_setPosition: function (x, y) {
		this.wall.style[transform] = 'translate(' + x + 'px,' + y + 'px)' + translateZ;

		this.x = x;
		this.y = y;
	},

	_rearrangeCells: function () {
		var screenX = Math.ceil(this.x / this.wallWidth),
			screenY = Math.ceil(this.y / this.wallHeight),
			virtualScreenX = Math.abs(screenX - Math.ceil(screenX / 2) * 2),
			virtualScreenY = Math.abs(screenY - Math.ceil(screenY / 2) * 2),
			posX = Math.ceil(this.x / this.cellWidth) * this.cellWidth / this.cellWidth,
			posY = Math.ceil(this.y / this.cellHeight) * this.cellHeight / this.cellHeight,
			x2 = Math.abs(posY - Math.ceil(posY / this.gridHeight) * this.gridHeight),
			y2 = Math.abs(posX - Math.ceil(posX / this.gridWidth) * this.gridWidth),
			phaseX = Math.abs((posX) - Math.ceil((posX) / this.virtualGridWidth) * this.virtualGridWidth),
			phaseY = Math.abs((posY) - Math.ceil((posY) / this.virtualGridHeight) * this.virtualGridHeight),
			i, l,
			x, y,
			slot,
			cells = [],
			that = this;


		if ( this.prevDirX === this.dirX && this.prevDirY === this.dirY && this.cellX === posX && this.cellY === posY ) return;

		this.cellX = posX;
		this.cellY = posY;
		this.prevDirX = this.dirX;
		this.prevDirY = this.dirY;
		

		for ( i = 0; i < this.gridWidth; i++ ) {
			if ( this.dirX < 0 ) {
				for ( l = 0; l < y2 + 1; l++ ) {
					this.cells[l][i].x = this.wallWidth * -screenX + this.wallWidth;
				}
			} else {
				for ( l = this.gridWidth - 1; l > y2 - 1; l-- ) {
					this.cells[l][i].x = -(this.wallWidth * screenX);
				}
			}
		}



		for ( i = 0; i < this.gridHeight; i++ ) {
			if ( this.dirY < 0 ) {
				for ( l = 0; l < x2 + 1; l++ ) {
					this.cells[i][l].y = this.wallHeight * -screenY + this.wallHeight;
				}
			} else {
				for ( l = this.gridHeight - 1; l > x2 - 1; l-- ) {
					this.cells[i][l].y = -(this.wallHeight * screenY);
				}
			}
		}




		for ( i = 0; i < this.gridWidth; i++ ) {
			if ( phaseX <= this.gridWidth ) {
				x = phaseX > i ? this.gridWidth + i : i;
			} else {
				x = phaseX - this.gridWidth > i ? i : this.gridWidth + i;
			}

			for ( l = 0; l < this.gridHeight; l++ ) {
				if ( phaseY <= this.gridHeight ) {
					y = phaseY > l ? this.gridHeight + l : l;
				} else {
					y = phaseY - this.gridHeight > l ? l : this.gridHeight + l;
				}

				slot = x + y * this.virtualGridWidth;
				
				if ( slot != this.cells[i][l].slot ) {
					this.cells[i][l].slot = slot;
					this.cells[i][l].el.className = 'loading';
					//this.cells[i][l].el.children[0].src = 'images/img' + this.cells[i][l].slot + '.jpg';
					this.cells[i][l].el.children[1].innerHTML = 'Image No. ' + this.cells[i][l].slot;
				}

				this.cells[i][l].el.style[transform] = 'translate(' + this.cells[i][l].x + 'px,' + this.cells[i][l].y + 'px)' + translateZ;
			}
		}



		this._loadTimeout = setTimeout(function () { that._loadImages(); }, 100);

	},

	_loadImages: function () {
		var x, y;

		for ( x = 0; x < this.gridWidth; x++ ) {
			for ( y = 0; y < this.gridHeight; y++ ) {
				if ( this.cells[x][y].slot === this.cells[x][y].prevSlot ) {
					this.cells[x][y].el.className = '';
				} else {
					// add mod 100 to load all images
					this.cells[x][y].el.children[0].src = 'images/img' + (this.cells[x][y].slot % 100) + '.jpg';
					this.cells[x][y].prevSlot = this.cells[x][y].slot;
				}
			}
		}
	},

	_getPosition: function () {
		// Lame alternative to CSSMatrix
		var matrix = window.getComputedStyle(this.wall, null)[transform].replace(/[^0-9\-.,]/g, '').split(','),
			x = +matrix[4],
			y = +matrix[5];

		return { x: x, y: y };
	},

	_setDuration: function (d) {
		// do not touch dom if not necessary
		d = d || 0; if (d == 0) {return false};
		this.wall.style[transitionDuration] = d + 'ms';
	},

	_start: function (e) {
		var point = hasTouch ? e.touches[0] : e,
			pos;

		if ( this.initiated ) return;

		e.preventDefault();

		clearTimeout(this._loadTimeout);
		this._loadTimeout = null;

		if ( this.isDecelerating ) {
			this.isDecelerating = false;
			pos = this._getPosition();

			if ( pos.x != this.x || pos.y != this.y ) {
				this._setPosition(pos.x, pos.y);
			}
		}

		this.initiated = true;
		this._setDuration(0);

		this.dirX = 0;
		this.dirY = 0;
		this.distX = 0;
		this.distY = 0;
		this.originX = this.x;
		this.originY = this.y;
		this.startX = point.pageX;
		this.startY = point.pageY;
		this.startTime = e.timeStamp || Date.now();
		
		this._bind(moveEv, document);
		this._bind(endEv, document);
		this._bind(cancelEv, document);
	},
	
	_move: function (e) {
		var point = hasTouch ? e.touches[0] : e,
			deltaX = point.pageX - this.startX,
			deltaY = point.pageY - this.startY;

		// isPreserveMoveSizeOnScale implementation
		deltaX = (this.options.isPreserveMoveSizeOnScale) ? deltaX*(1/scale) : deltaX;
		deltaY = (this.options.isPreserveMoveSizeOnScale) ? deltaY*(1/scale) : deltaY;

		var newX = this.x + deltaX,
			newY = this.y + deltaY,
			timestamp = e.timeStamp || Date.now(),
			that = this;

		if ( hasTouch && e.changedTouches.length > 1 ) return;

		clearTimeout(this._loadTimeout);
		this._loadTimeout = null;

		this.distX += Math.abs(deltaX);
		this.distY += Math.abs(deltaY);

		this.dirX = deltaX < 0 ? -1 : deltaX > 0 ? 1 : 0;
		this.dirY = deltaY < 0 ? -1 : deltaY > 0 ? 1 : 0;

		// 10 px actuation point
		if ( this.distX < 10 && this.distY < 10 ) {
			return;
		}

		this.startX = point.pageX;
		this.startY = point.pageY;

		this._setPosition(newX, newY);

		this._rearrangeCells();

		if ( timestamp - this.startTime > 300 ) {
			this.startTime = timestamp;
			this.originX = this.x;
			this.originY = this.y;
			this._loadTimeout = setTimeout(function () { that._loadImages(); }, 100);
		}
	},

	_saveScale:function () {
		scale = parseFloat(window.getComputedStyle(this.inner, null)[transform].replace(/[^0-9\-.,]/g, '').split(',')[0]);
		return scale;
	},

	_end: function (e) {
		if (this.isScale){this.isScale = false;
			this._saveScale()
		}
		
		if ( hasTouch && e.changedTouches.length > 1 ) return;

		clearTimeout(this._loadTimeout);
		this._loadTimeout = null;

		var point = hasTouch ? e.touches[0] : e,
			duration = ( e.timeStamp || Date.now() ) - this.startTime,
			newX, newY,
			that = this;

		this._rearrangeCells();

		if ( duration < 300 ) {
			newX = destination(this.x - this.originX, duration);
			newY = destination(this.y - this.originY, duration);
			this._momentum(this.x + newX.distance, this.y + newY.distance, Math.max(newX.duration, newY.duration));
		} else {
			that._loadImages();
		}

		this.initiated = false;

		this._unbind(moveEv, document);
		this._unbind(endEv, document);
		this._unbind(cancelEv, document);
	},

	// scale fun
	_scale:function(amount){
		// if scale is more then maxScale then stop scalings
		if ((scale*amount<(1/this.options.maxScale))||(scale*amount>(this.options.maxScale))) {return false;}
		// scaleMode flage is used in _end gesture function
		this.isScale = true;
		// scale wall wrapper
		this.inner.style[transform] = 'scale(' + scale*amount + ')';
		// if container needs more images on scale
		if ((scale*amount*this.wallWidth)-((this.wallWidth*scale*amount)/4) <= this.windowWidth){
				this._initialize(null, {gridSize: this.options.gridSize + this.gridScaleStep})
				// bug fixes
				this._setPosition(0, 0);
				this._rearrangeCells()
			} 
		
	},
	_momentum: function (destX, destY, duration) {
		var startTime = Date.now(),
			startX = this.x,
			startY = this.y,
			that = this;

		function frame () {
			var now = Date.now(),
				newX, newY,
				easeOut;

			if ( now >= startTime + duration ) {
				that.isDecelerating = false;
				that._setPosition(destX, destY);
				that._loadImages();
				return;
			}

			now = (now - startTime) / duration;
			easeOut = Math.sqrt(1 - ( --now * now ));
			newX = (destX - startX) * easeOut + startX;
			newY = (destY - startY) * easeOut + startY;

			that._setPosition(newX, newY);
			that._rearrangeCells();

			if ( that.isDecelerating ) requestFrame(frame);
		}

		this.isDecelerating = true;
		frame();
	}
};

function destination (distance, time) {
	var speed = Math.abs(distance) / time,
		friction = 0.0025;

	distance = ( speed * speed ) / ( 2 * friction ) * ( distance < 0 ? -1 : 1 );
	time = speed / friction;

	return { distance: Math.round(distance), duration: Math.round(time) };
}

function prefixStyle (style) {
	if ( vendor === '' ) return style;

	style = style.charAt(0).toUpperCase() + style.substr(1);
	return vendor + style;
}

function imgLoaded () {
	var el = this.parentNode;
	el.className = '';
}


window.InfiniWall = InfiniWall;

})(window, document);