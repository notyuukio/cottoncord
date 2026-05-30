'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('installer', {
  getInfo:   ()      => ipcRenderer.invoke('get-info'),
  install:   ()      => ipcRenderer.invoke('install'),
  reinstall: ()      => ipcRenderer.invoke('reinstall'),
  uninstall: ()      => ipcRenderer.invoke('uninstall'),
});
