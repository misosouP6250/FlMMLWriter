"use strict";
const {ipcRenderer} = require("electron");

ipcRenderer.on("open-file", (event, arg) => {
    writer.setMMLText(arg);
});