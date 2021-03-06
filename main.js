const electron = require("electron");
const { app, BrowserView, BrowserWindow, ipcMain, shell, dialog } = electron;
const fs = require("fs");
const userDataPath = app.getPath("userData");
const keytar = require("keytar"); // Load keytar to manage user API keys

let mainWindow;

const basePath = app.getAppPath();

//FileSystem
const userDataDirTree = (path, dirTree) => {
  dirTree.forEach(d => {
    if (!fs.existsSync(path + d)) {
      fs.mkdirSync(path + d, { recursive: true }, err => {
        if (err) throw err;
      });
    }
  });
};

let userID;

const createUserId = () => {
  userID = {
    UserName: "Enter your name",
    UserMail: "Enter your e-mail (not required)",
    ZoteroID: "Enter your Zotero ID (required to use Flux features)",
    theme: "normal",
    locale:"EN"
  };

  if (!fs.existsSync(userDataPath + "/userID/user-id.json")) {
    fs.writeFileSync(
      userDataPath + "/userID/user-id.json",
      JSON.stringify(userID),
      "utf8",
      err => {
        if (err) throw err;
      }
    );
  }
};

const createThemes = () => {
  if (!fs.existsSync(userDataPath + "/themes/themes.json")) {
    fs.copyFileSync(
      basePath + "/json/themes.json",
      userDataPath + "/themes/themes.json"
    );
  }
};

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    fullscreenable: true,
    backgroundColor: "white",
    titleBarStyle: "hidden",
    frame: true,
    resizable: true,
    webPreferences: {
      nodeIntegration: true,
      nodeIntegrationInWorker: true,
      plugins: true
    }
  });

  mainWindow.loadFile("index.html");

  mainWindow.webContents.on(
    "new-window",
    (event, url, frameName, disposition, options, additionalFeatures) => {
      if (frameName === "modal") {
        event.preventDefault();

        Object.assign(options, {
          modal: true,
          parent: mainWindow,
          frame: true,
          webPreferences: {
            nodeIntegration: true,
            nodeIntegrationInWorker: true
          }
        });

        event.newGuest = new BrowserWindow(options);
      }
    }
  );

  mainWindow.setMenu(null);
  //mainWindow.webContents.openDevTools();
  mainWindow.on("closed", () => {
    mainWindow = null;
  
  });
}

app.on("ready", () => {
  userDataDirTree(userDataPath, [
    "/logs",
    "/userID",
    "/themes",
    "/flatDatasets"
  ]);
  createUserId();
  createThemes();
  createWindow();
  createAudioManager();

  mainWindow.onbeforeunload = e => {
    BrowserView.getAllViews().forEach(view => view.destroy());
  };
});



var windowIds = [
  { name: "flux", id: 0, open: false },
  { name: "tutorialHelper", id: 0, open: false },
  { name: "tutorial", id: 0, open: false },
  { name: "chaeros", id: 0, open: false }
];

ipcMain.on("window-ids", (event, window, id, open) => {
  windowIds.forEach(d => {
    if (d.name === window) {
      d.id = id;
      d.open = open;
    }
  });
});

const openHelper = helperFile => {
  let screenWidth = electron.screen.getPrimaryDisplay().workAreaSize.width;
  let screenHeight = electron.screen.getPrimaryDisplay().workAreaSize.height;

  let win = new BrowserWindow({
    backgroundColor: "white",
    resizable: false,
    frame: true,
    width: 350,
    height: 700,
    alwaysOnTop: true,
    autoHideMenuBar: true,
    x: screenWidth - 350,
    y: 100,
    webPreferences: {
      nodeIntegration: true,
      nodeIntegrationInWorker: true
    }
  });
  win.once("ready-to-show", () => {
    win.show();
  });
  var path = "file://" + __dirname + "/" + helperFile + ".html";
  win.loadURL(path);
};

const openModal = (modalFile, scrollTo) => {
  for (let i = 0; i < windowIds.length; i++) {
    if (windowIds[i].name === modalFile) {
      if (windowIds[i].open === false) {
        let win = new BrowserWindow({
         // backgroundColor: "white",
          parent: mainWindow,
          modal: true,
          transparent:true,
          alwaysOnTop: false,
          frame: false,
          resizable: false,
          show: false,
          y: 100,
          webPreferences: {
            nodeIntegration: true,
            nodeIntegrationInWorker: true
          }
        });

        var path = "file://" + __dirname + "/" + modalFile + ".html";
        win.loadURL(path);
        win.once("ready-to-show", () => {
          win.show();
          if (scrollTo) {
            setTimeout(() => win.webContents.send("scroll-to", scrollTo), 1000);
          }
        });
      }
    }
  }
};

ipcMain.on("window-manager", (event, type, file, scrollTo, section) => {
  let win = {};

  switch (type) {
    case "openHelper":
      openHelper(file);

      setTimeout(() => {
        for (var i = 0; i < windowIds.length; i++) {
          if (windowIds[i].name === file) {
            BrowserWindow.fromId(windowIds[i].id).webContents.send(
              "tutorial-types",
              section
            );
          }
        }
      }, 800);

      break;
    case "openModal":
      openModal(file, scrollTo);
      break;
    case "closeWindow":
      try {
        for (var i = 0; i < windowIds.length; i++) {
          if (windowIds[i].name === file) {
            win = BrowserWindow.fromId(windowIds[i].id);
          }
        }
        win.webContents.send("window-close", "close");
      } catch (e) {
        console.log(e);
      }
      break;
  }
});

//CONSOLE

let date = new Date().toJSON().replace(/:/g, "-"); // Create a timestamp
var dataLog = "PANDORÆ Log - " + date;

ipcMain.on("console-logs", (event, message) => {
  let newLine =
    "\r\n" + new Date().toLocaleTimeString("fr-FR") + " ~ " + message;
  dataLog = dataLog + newLine;
  mainWindow.webContents.send("console-messages", newLine); // send it to requester
});

// CHAEROS
const powerValveArgsArray = [];

ipcMain.on("dataFlux", (event, fluxAction, fluxArgs, message) => {
  mainWindow.webContents.send("coreSignal", fluxAction, fluxArgs, message);

  let powerValveAction = {};

  powerValveAction.fluxAction = fluxAction;
  powerValveAction.fluxArgs = fluxArgs;
  powerValveAction.message = message;

  powerValveArgsArray.push(powerValveAction);

  chaerosCalculator();
});

ipcMain.on("chaeros-failure", (event, message) => {
  mainWindow.webContents.send("chaeros-failure", message);
});

ipcMain.on("chaeros-notification", (event, message, options) => {
  mainWindow.webContents.send("chaeros-notification", message, options);
});

ipcMain.on("pulsar", (event, message) => {
  mainWindow.webContents.send("pulsar", message);
});

ipcMain.on("keytar", (event, request) => {

switch (request.type) {
  case "setPassword":
    keytar
    .setPassword(request.service, request.user,request.value)
    .then(password => event.returnValue = password);
    break;

  case "getPassword":
    keytar
    .getPassword(request.service, request.user)
    .then(password => event.returnValue = password);
    break;
}

 

}); 

ipcMain.on("chaeros-is-ready", (event, arg) => {
  let action = powerValveArgsArray[powerValveArgsArray.length - 1];
  event.sender.send(
    "chaeros-compute",
    action.fluxAction,
    action.fluxArgs,
    action.message
  );
});


const chaerosCalculator = () => {
  let chaerosWindow = new BrowserWindow({
    width: 10,
    height: 10,
    frame: false,
    transparent: true,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      nodeIntegrationInWorker: true
    }
  });

  chaerosWindow.loadFile("chaeros.html");

  chaerosWindow.webContents.on("did-finish-load", function() {
    //chaerosWindow.webContents.openDevTools();
  });
};




const createAudioManager = () => {
  let audioManager = new BrowserWindow({
    width: 10,
    height: 10,
    frame: false,
    transparent: true,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      nodeIntegrationInWorker: true
    }
  });

audioManager.loadFile("audioManager.html")
audioManager.webContents.on("did-finish-load", function() {
 // audioManager.webContents.openDevTools();
});
ipcMain.on("audio-channel", (event, audio) => {
  audioManager.webContents.send("audio-channel", audio);
});

mainWindow.on("closed", () => {
            setTimeout(() => {
                app.quit();
            }, 1000);
        });
    };

app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();    
  }
});

// Quit when all windows are closed.
app.on("window-all-closed", function() {
  // Write log
  fs.writeFile(
    // Write data
    userDataPath + "/logs/log-" + date + ".txt",
    dataLog,
    "utf8", // Path/name, data, format
    err => {
      if (err) throw err;
      setTimeout(() => {
        app.quit();
      }, 1000);
    }
  );
});

// Tutorial
ipcMain.on("tutorial", (event, message) => {
  mainWindow.webContents.send("tutorial", message);
});

ipcMain.on("mainWindowReload", (event, message) => {
  mainWindow.webContents.send("mainWindowReload", message);
});

// ProgressBar
ipcMain.on("progress", (event, message) => {
  let ratio = parseInt(message);
  mainWindow.webContents.send("progressBar", ratio);
});


ipcMain.on("cmdInputFromRenderer", (event, theme) => {
  mainWindow.webContents.send("cmdInputFromRenderer", theme);
});

ipcMain.on("backToPres", (event, message) => {
  mainWindow.reload()
  setTimeout(() => {
    mainWindow.webContents.send("backToPres", message);
  }, 500);
})


const artooScraper = (model,address) => {
  let artooWindow = new BrowserWindow({
    width: 10,
    height: 10,
    frame: false,
    transparent: true,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      nodeIntegrationInWorker: true,
      preload: basePath+'/js/artoo-models/'+model+'.js',
      webSecurity:false
    }
  });

  artooWindow.loadURL(address);

  artooWindow.webContents.on("did-finish-load", function() {
    //artooWindow.webContents.openDevTools();
  });
};

ipcMain.on("artoo", (event, message) => {
  switch (message.type) {
    case "request":
      artooScraper(message.model,message.address) 
      break;
  
    case 'biorxiv-amount':
      for (var i = 0; i < windowIds.length; i++) {
        if (windowIds[i].name === "flux") {
          BrowserWindow.fromId(windowIds[i].id).webContents.send('artoo',message)
        }
      }
     
      case 'biorxiv-content':
      for (var i = 0; i < windowIds.length; i++) {
        if (windowIds[i].name === "chaeros" && windowIds[i].id>0) {
          BrowserWindow.fromId(windowIds[i].id).webContents.send('artoo',message)
        }
      }

      break;
  }

});
