;(function(undefined) {

    /**
     * artoo chrome injection
     * =======================
     *
     * This chrome content script injects artoo in every relevant page when the
     * artoo's extension is activated.
     */

    const { remote, ipcRenderer } = require("electron");
    const appPath = remote.app.getAppPath();
  
    var body;
    if ('document' in this) {
      body = document.getElementsByTagName('body')[0];
      if (!body) {
        body = document.createElement('body');
        document.documentElement.appendChild(body);
      }
    }

    function injectScript(type,url) {
      // Creating script element
      window.addEventListener('DOMContentLoaded', (event) => {
        var script = document.createElement('script'),
        body = document.getElementsByTagName('body')[0];

        script.src = url;
        script.type = 'text/javascript';
        script.id = type+'_injected_script';
        script.setAttribute('chrome', 'true');

        // Appending to body
        body.appendChild(script);

      });
      
    }

    injectScript("jQuery",'https://code.jquery.com/jquery-2.1.3.min.js'); 
    injectScript("artoo","file://"+appPath+'/node_modules/artoo-js/build/artoo.chrome.js');
   
      const plug = () => {
        let content = artoo.scrape('.highwire-cite-metadata-doi');
        ipcRenderer.send('artoo',{type:"biorxiv-content",content:content});
        setTimeout(() => {
          remote.getCurrentWindow().close();
        }, 200);
      }

    window.addEventListener('load', e=> {
      if (artoo.loaded) {
        plug();
      } else {
      artoo.on('ready',plug)
    }      
    })

  }).call(this);