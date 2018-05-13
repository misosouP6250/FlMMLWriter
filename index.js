"use strct";

const electron = require("electron");
const app = electron.app;
const Menu = electron.Menu;
const dialog = electron.dialog;
const BrowserWindow = electron.BrowserWindow;

const fs = require("fs");
const path = require("path");
const url = require("url");

let mainWindow = null;

app.on("window-all-closed", () => {
    if (process.platform != "darwin") {
        app.quit();
    }
});

app.on("ready", () => {
    mainWindow = new BrowserWindow({
        width: 800, height: 600,
        backgroundColor: "#000",
        useContentSize: true
    });

    mainWindow.eval = global.eval = function () {
        throw new Error(`Sorry, this app does not support window.eval().`);
    }

    mainWindow.loadURL(url.format({
        pathname: path.join(__dirname, "index.html"),
        protocol: "file:",
        slashes: true
    }));
    
    mainWindow.on("closed", () => {
        mainWindow = null;
    });

    initWindowMenu();

    mainWindow.webContents.openDevTools();
});

function initWindowMenu(){
    const template = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'Open',
                    click () { 
                        let filenames = dialog.showOpenDialog(mainWindow, {
                            properties: ["openFile"],
                            title: "Select a MML text",
                            defaultPath: ".",
                            filters: [
                                {name: "MML text", extensions: ["mml","fml"]},
                                {name: "All Files", extensions: ['*']}
                            ]
                        });
                        fs.readFile(filenames[0], "utf8", (err, data) => {
                            if (err) {
                                return console.log(err);
                            }
                            if(mainWindow) {
                                mainWindow.webContents.send("open-file", data);
                            }
                        });
                    }
                },
                {
                    role: "quit"
                }
            ]
        }
    ]
 
    const menu = Menu.buildFromTemplate(template)
    Menu.setApplicationMenu(menu)
}