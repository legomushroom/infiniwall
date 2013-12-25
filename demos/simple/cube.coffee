class Cube
	constructor:(@o={})->
		@el = if typeof @o.el is 'string' then @$(@o.el) else @o.el
		@vars()
		@listenToEvents()

	vars:->
		@vendor = @prefix()
		@cubeDeltaX = 0
		@cubeDeltaY = 0
		@transform = @vendorPrefix('transform')
		@hasTouch = 'ontouchstart' in window
		@startEv = 		if @hasTouch then 	'touchstart' 	else 'mousedown'
		@moveEv = 		if @hasTouch then 	'touchmove' 	else 'mousemove'
		@endEv = 			if @hasTouch then 	'touchend' 		else 'mouseup'
		@cancelEv = 	if @hasTouch then   'touchcancel' else 'mouseup'
		
	listenToEvents:->
		@on @startEv,  @el
		@on @moveEv,   document
		@on @endEv,    document
		@on @cancelEv, document

	$:(selector)-> document.querySelector(selector)

	on:(type,el,bubble)-> el.addEventListener(type, @, !!bubble)

	off:(type,el,bubble)-> el.removeEventListener(type, @, !!bubble)

	vendorPrefix:(style)-> @vendor + style

	prefix: ->
		styles = window.getComputedStyle(document.documentElement, "")
		pre = (Array::slice.call(styles).join("").match(/-(moz|webkit|ms)-/) or (styles.OLink is "" and ["", "o"]))[1]
		dom = ("WebKit|Moz|MS|O").match(new RegExp("(" + pre + ")", "i"))[1]
		"-" + pre + "-"

	startHandler:(e)-> 
		@isTouch = true
		point = if @hasTouch then e.touches[0] else e
		@startX = point.pageX
		@startY = point.pageY
	endHandler:-> 
		@isTouch = false
		@cubeDeltaX += @deltaX if @deltaX
		@cubeDeltaY += @deltaY if @deltaY
	moveHandler:(e)->
		return if !@isTouch or (!e.metaKey or !e.touches?.length is 2)
		point = if @hasTouch then e.touches[0] else e
		@deltaX = point.pageX - @startX
		@deltaY = point.pageY - @startY
		@deltaY = -@deltaY
		@el.style[@transform] = "rotateX(#{@cubeDeltaY+@deltaY}deg) rotateY(#{@cubeDeltaX+@deltaX}deg)"

	handleEvent:(e)-> 
		switch e.type
			when @startEv
				return if ( !@hasTouch and e.button isnt 0 )
				@startHandler(e)
			when @moveEv
				@moveHandler(e)
			when @cancelEv, @endEv
				@endHandler(e)

window.Cube = Cube