import electron, {remote} from 'electron';
import fs from 'fs';
import path from 'path';
import semver from 'semver';

import downloadChromeExtension from './downloadChromeExtension';
import {getPath} from './utils';

const {BrowserWindow} = remote || electron;

let IDMap = {};
const IDMapPath = path.resolve(getPath(), 'IDMap.json');
if (fs.existsSync(IDMapPath)) {
    IDMap = JSON.parse(fs.readFileSync(IDMapPath, 'utf8'));
}

const install = (extensionReference, forceDownload = false) => {
    if (Array.isArray(extensionReference)) {
        return Promise.all(extensionReference.map(extension => install(extension, forceDownload)));
    }
    let chromeStoreID;
    if (typeof extensionReference === 'object' && extensionReference.id) {
        chromeStoreID = extensionReference.id;
        if (!semver.satisfies(process.versions.electron, extensionReference.electron)) {
            return Promise.reject(
                new Error(`Version of Electron: ${process.versions.electron} does not match required range ${extensionReference.electron} for extension ${chromeStoreID}`), // eslint-disable-line
            );
        }
    } else if (typeof extensionReference === 'string') {
        chromeStoreID = extensionReference;
    } else {
        return Promise.reject(new Error(`Invalid extensionReference passed in: "${extensionReference}"`));
    }
    const extensionName = IDMap[chromeStoreID];
    const extensionInstalled = extensionName &&
        BrowserWindow.getDevToolsExtensions &&
        BrowserWindow.getDevToolsExtensions()[extensionName];
    if (!forceDownload && extensionInstalled) {
        return Promise.resolve(IDMap[chromeStoreID]);
    }
    return downloadChromeExtension(chromeStoreID, forceDownload)
        .then((extensionFolder) => {
            // Use forceDownload, but already installed
            if (extensionInstalled) {
                BrowserWindow.removeDevToolsExtension(extensionName);
            }
            const name = BrowserWindow.addDevToolsExtension(extensionFolder); // eslint-disable-line
            fs.writeFileSync(
                IDMapPath,
                JSON.stringify(Object.assign(IDMap, {
                    [chromeStoreID]: name,
                })),
            );
            return Promise.resolve(name);
        });
};

export default install;
