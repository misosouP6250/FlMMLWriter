"use strict";
	var writer;
	document.addEventListener("DOMContentLoaded", function () {
		writer = new FlMMLWriter();
	});
	window.addEventListener("load", function () {
		writer.changeHltMode("delay");
	});