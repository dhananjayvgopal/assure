const { app, BrowserWindow, dialog, shell, ipcMain } = require('electron');
const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

app.setName('Assure POS');

let httpServer;

ipcMain.handle('assure-pos:print-silently', (event, options = {}) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window || window.isDestroyed()) return { success: false, reason: 'The POS print window is unavailable.' };
  const clamp = (value, minimum, maximum, fallback) => {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(minimum, Math.min(maximum, number)) : fallback;
  };
  const widthMm = clamp(options.pageWidthMm, 35, 300, 80);
  const heightMm = clamp(options.pageHeightMm, 35, 1000, 210);
  return new Promise((resolve) => {
    window.webContents.print({
      silent: true,
      printBackground: true,
      pageSize: { width: Math.round(widthMm * 1000), height: Math.round(heightMm * 1000) },
      margins: { marginType: 'none' },
      scaleFactor: 100,
    }, (success, failureReason) => {
      resolve({ success, reason: success ? '' : (failureReason || 'Printing failed. Check the default printer and paper settings.') });
    });
  });
});

ipcMain.handle('assure-pos:save-as-pdf', async (event, options = {}) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window || window.isDestroyed()) return { success: false, reason: 'The POS print window is unavailable.' };
  try {
    const requestedName = path.basename(String(options.fileName || 'invoice.pdf')).replace(/[<>:"/\\|?*]/g, '_');
    const downloadName = requestedName.toLowerCase().endsWith('.pdf') ? requestedName : `${requestedName}.pdf`;
    const downloadDirectory = app.getPath('downloads');
    const extension = path.extname(downloadName) || '.pdf';
    const baseName = path.basename(downloadName, extension);
    let outputPath = path.join(downloadDirectory, downloadName);
    let suffix = 1;
    while (fs.existsSync(outputPath)) {
      outputPath = path.join(downloadDirectory, `${baseName}-${suffix}${extension}`);
      suffix += 1;
    }

    const clamp = (value, minimum, maximum, fallback) => {
      const number = Number(value);
      return Number.isFinite(number) ? Math.max(minimum, Math.min(maximum, number)) : fallback;
    };
    const widthMm = clamp(options.pageWidthMm, 35, 300, 210);
    const heightMm = clamp(options.pageHeightMm, 35, 1000, 297);
    const pdf = await window.webContents.printToPDF({
      printBackground: true,
      preferCSSPageSize: true,
      pageSize: { width: widthMm / 25.4, height: heightMm / 25.4 },
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
    });
    await fs.promises.writeFile(outputPath, pdf);
    return { success: true, path: outputPath };
  } catch (error) {
    return { success: false, reason: error instanceof Error ? error.message : 'Could not save the PDF.' };
  }
});

async function startPos() {
  const userData = app.getPath('userData');
  const dataDirectory = path.join(userData, 'database');
  fs.mkdirSync(dataDirectory, { recursive: true });
  process.env.POS_DB_PATH = path.join(dataDirectory, 'fnd-clothing-pos.sqlite');
  process.env.POS_SCHEMA_PATH = path.join(process.resourcesPath, 'database', 'schema.sql');

  const apiBundle = path.join(app.getAppPath(), 'dist', 'electron', 'database.mjs');
  const { databaseApi } = await import(pathToFileURL(apiBundle).href);
  const webApp = express();
  const distPath = path.join(app.getAppPath(), 'dist');
  webApp.use(express.json({ limit: '12mb' }));
  webApp.use('/api', databaseApi);
  webApp.use(express.static(distPath));
  webApp.get('/api/health', (_req, res) => res.json({ status: 'online', app: 'Assure POS', database: 'sqlite' }));
  webApp.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));

  await new Promise((resolve, reject) => {
    httpServer = webApp.listen(0, '127.0.0.1', resolve);
    httpServer.once('error', reject);
  });
  const address = httpServer.address();
  const window = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 960,
    minHeight: 680,
    title: 'Assure POS',
    backgroundColor: '#f8f7f4',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(app.getAppPath(), 'electron', 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url);
    return { action: 'deny' };
  });
  await window.loadURL(`http://127.0.0.1:${address.port}/`);
}

app.whenReady().then(startPos).catch((error) => {
  dialog.showErrorBox('Assure POS could not start', `${error.message}\n\nYour saved shop data has not been deleted.`);
  app.quit();
});

app.on('before-quit', () => {
  if (httpServer) httpServer.close();
});
app.on('window-all-closed', () => app.quit());
