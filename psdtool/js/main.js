/// <reference path="../typings/browser.d.ts" />
'use strict';
(function () {
    var originalStopCallback = Mousetrap.prototype.stopCallback;
    Mousetrap.prototype.stopCallback = function (e, element, combo) {
        if (!this.paused) {
            if (element.classList.contains('psdtool-layer-visible')) {
                return false;
            }
        }
        return originalStopCallback.call(this, e, element, combo);
    };
    Mousetrap.init();
    var ui = {
        optionAutoTrim: null,
        optionSafeMode: null,
        sideBody: null,
        sideBodyScrollPos: null,
        normalModeState: null,
        previewCanvas: null,
        previewBackground: null,
        redraw: null,
        save: null,
        showReadme: null,
        invertInput: null,
        fixedSide: null,
        maxPixels: null,
        seqDlPrefix: null,
        seqDlNum: null,
        seqDl: null,
        favoriteToolbar: null,
        filterEditingTarget: null,
        useFilter: null,
        filterTree: null,
        bulkCreateFolderTextarea: null,
        bulkRenameData: null,
    };
    var renderer;
    var psdRoot;
    var filterRoot;
    var layerRoot;
    var favorite;
    var droppedPFV;
    function init() {
        initDropZone('dropzone', function (files) {
            var i, ext;
            for (i = 0; i < files.length; ++i) {
                ext = files[i].name.substring(files[i].name.length - 4).toLowerCase();
                if (ext === '.pfv') {
                    droppedPFV = files[i];
                    break;
                }
            }
            for (i = 0; i < files.length; ++i) {
                ext = files[i].name.substring(files[i].name.length - 4).toLowerCase();
                if (ext !== '.pfv') {
                    loadAndParse(files[i]);
                    return;
                }
            }
        });
        initUI();
        document.getElementById('samplefile').addEventListener('click', function (e) {
            return loadAndParse(document.getElementById('samplefile').getAttribute('data-filename'));
        }, false);
        window.addEventListener('resize', resized, false);
        window.addEventListener('hashchange', hashchanged, false);
        hashchanged();
        var elems = document.querySelectorAll('.psdtool-loading');
        for (var i = 0; i < elems.length; ++i) {
            elems[i].classList.add('psdtool-loaded');
            elems[i].classList.remove('psdtool-loading');
        }
    }
    function resized() {
        var mainContainer = document.getElementById('main-container');
        var miscUi = document.getElementById('misc-ui');
        var previewContainer = document.getElementById('preview-container');
        previewContainer.style.display = 'none';
        previewContainer.style.width = mainContainer.clientWidth + 'px';
        previewContainer.style.height = (mainContainer.clientHeight - miscUi.offsetHeight) + 'px';
        previewContainer.style.display = 'block';
        var sideContainer = document.getElementById('side-container');
        var sideHead = document.getElementById('side-head');
        var sideBody = document.getElementById('side-body');
        sideBody.style.display = 'none';
        sideBody.style.width = sideContainer.clientWidth + 'px';
        sideBody.style.height = (sideContainer.clientHeight - sideHead.offsetHeight) + 'px';
        sideBody.style.display = 'block';
        document.getElementById('favorite-tree').style.paddingTop = ui.favoriteToolbar.clientHeight + 'px';
    }
    function hashchanged() {
        var hashData = decodeURIComponent(location.hash.substring(1));
        if (hashData.substring(0, 5) === 'load:') {
            loadAndParse(hashData.substring(5));
        }
    }
    function updateProgress(barElem, captionElem, progress, caption) {
        var p = progress * 100;
        barElem.style.width = p + '%';
        barElem.setAttribute('aria-valuenow', p.toFixed(0) + '%');
        removeAllChild(captionElem);
        captionElem.appendChild(document.createTextNode(p.toFixed(0) + '% ' + caption));
    }
    function loadAndParse(file_or_url) {
        var fileOpenUi = document.getElementById('file-open-ui');
        var fileLoadingUi = document.getElementById('file-loading-ui');
        var errorReportUi = document.getElementById('error-report-ui');
        var main = document.getElementById('main');
        var bar = document.getElementById('progress-bar');
        fileOpenUi.style.display = 'none';
        fileLoadingUi.style.display = 'block';
        errorReportUi.style.display = 'none';
        main.style.display = 'none';
        Mousetrap.pause();
        var caption = document.getElementById('progress-caption');
        var errorMessageContainer = document.getElementById('error-message');
        var errorMessage = document.createTextNode('');
        removeAllChild(errorMessageContainer);
        errorMessageContainer.appendChild(errorMessage);
        var progress = function (phase, progress) {
            var msg;
            switch (phase) {
                case 'prepare':
                    msg = 'Getting ready...';
                    break;
                case 'receive':
                    msg = 'Receiving file...';
                    break;
                case 'load':
                    msg = 'Loading file...';
                    break;
            }
            updateProgress(bar, caption, progress, msg);
        };
        progress('prepare', 0);
        loadAsBlob(progress, file_or_url)
            .then(parse.bind(this, progress.bind(this, 'load')))
            .then(function (obj) { return initMain(obj.psd, obj.name); })
            .then(function () {
            fileLoadingUi.style.display = 'none';
            fileOpenUi.style.display = 'none';
            errorReportUi.style.display = 'none';
            main.style.display = 'block';
            Mousetrap.unpause();
            resized();
        }, function (e) {
            fileLoadingUi.style.display = 'none';
            fileOpenUi.style.display = 'block';
            errorReportUi.style.display = 'block';
            main.style.display = 'none';
            Mousetrap.pause();
            errorMessage.textContent = e.toString();
            console.error(e);
        });
    }
    function loadAsBlobCrossDomain(progress, url) {
        var deferred = m.deferred();
        if (location.protocol === 'https:' && url.substring(0, 5) === 'http:') {
            setTimeout(function () { return deferred.reject(new Error('cannot access to the insecure content from HTTPS.')); }, 0);
            return deferred.promise;
        }
        var ifr = document.createElement('iframe'), port;
        var timer = setTimeout(function () {
            port.onmessage = null;
            document.body.removeChild(ifr);
            deferred.reject(new Error('something went wrong'));
        }, 20000);
        ifr.setAttribute('sandbox', 'allow-scripts allow-same-origin');
        ifr.onload = function () {
            var msgCh = new MessageChannel();
            port = msgCh.port1;
            port.onmessage = function (e) {
                if (timer) {
                    clearTimeout(timer);
                    timer = null;
                }
                if (!e.data || !e.data.type) {
                    return;
                }
                switch (e.data.type) {
                    case 'complete':
                        document.body.removeChild(ifr);
                        if (!e.data.data) {
                            deferred.reject(new Error('something went wrong'));
                            return;
                        }
                        progress('receive', 1);
                        deferred.resolve({
                            buffer: e.data.data,
                            name: e.data.name ? e.data.name : extractFilePrefixFromUrl(url)
                        });
                        return;
                    case 'error':
                        document.body.removeChild(ifr);
                        deferred.reject(new Error(e.data.message ? e.data.message : 'could not receive data'));
                        return;
                    case 'progress':
                        if (('loaded' in e.data) && ('total' in e.data)) {
                            progress('receive', e.data.loaded / e.data.total);
                        }
                        return;
                }
            };
            ifr.contentWindow.postMessage(location.protocol, url.replace(/^([^:]+:\/\/[^\/]+).*$/, '$1'), [msgCh.port2]);
        };
        ifr.src = url;
        ifr.style.display = 'none';
        document.body.appendChild(ifr);
        return deferred.promise;
    }
    function loadAsBlobFromString(progress, url) {
        if (url.substring(0, 3) === 'xd:') {
            return loadAsBlobCrossDomain(progress, url.substring(3));
        }
        var deferred = m.deferred();
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url);
        xhr.responseType = 'blob';
        xhr.onload = function (e) {
            progress('receive', 1);
            if (xhr.status === 200) {
                deferred.resolve({
                    buffer: xhr.response,
                    name: extractFilePrefixFromUrl(url)
                });
                return;
            }
            deferred.reject(new Error(xhr.status + ' ' + xhr.statusText));
        };
        xhr.onerror = function (e) {
            console.error(e);
            deferred.reject(new Error('could not receive data'));
        };
        xhr.onprogress = function (e) { return progress('receive', e.loaded / e.total); };
        xhr.send(null);
        return deferred.promise;
    }
    function loadAsBlob(progress, file_or_url) {
        progress('prepare', 0);
        if (typeof file_or_url === 'string') {
            return loadAsBlobFromString(progress, file_or_url);
        }
        else {
            var deferred = m.deferred();
            setTimeout(function () { return deferred.resolve({
                buffer: file_or_url,
                name: file_or_url.name.replace(/\..*$/i, '') + '_'
            }); }, 0);
            return deferred.promise;
        }
    }
    function extractFilePrefixFromUrl(url) {
        url = url.replace(/#[^#]*$/, '');
        url = url.replace(/\?[^?]*$/, '');
        url = url.replace(/^.*?([^\/]+)$/, '$1');
        url = url.replace(/\..*$/i, '') + '_';
        return url;
    }
    function parse(progress, obj) {
        var deferred = m.deferred();
        PSD.parseWorker(obj.buffer, progress, function (psd) { return deferred.resolve({ psd: psd, name: obj.name }); }, function (error) { return deferred.reject(error); });
        return deferred.promise;
    }
    function removeAllChild(elem) {
        for (var i = elem.childNodes.length - 1; i >= 0; --i) {
            elem.removeChild(elem.firstChild);
        }
    }
    function initMain(psd, name) {
        var deferred = m.deferred();
        setTimeout(function () {
            try {
                renderer = new Renderer.Renderer(psd);
                var layerTree = document.getElementById('layer-tree');
                layerRoot = new LayerTree.LayerTree(ui.optionSafeMode.checked, layerTree, psd);
                filterRoot = new LayerTree.Filter(ui.filterTree, psd);
                for (var key in renderer.nodes) {
                    if (!renderer.nodes.hasOwnProperty(key)) {
                        continue;
                    }
                    (function (r, l) {
                        r.getVisibleState = function () { return l.checked; };
                    })(renderer.nodes[key], layerRoot.nodes[key]);
                }
                layerTree.addEventListener('click', function (e) {
                    var target = e.target;
                    if (target instanceof HTMLInputElement && target.classList.contains('psdtool-layer-visible')) {
                        var n = layerRoot.nodes[parseInt(target.getAttribute('data-seq'), 10)];
                        for (var p = n.parent; !p.isRoot; p = p.parent) {
                            p.checked = true;
                        }
                        if (n.clippedBy) {
                            n.clippedBy.checked = true;
                        }
                        ui.redraw();
                    }
                }, false);
                ui.maxPixels.value = (ui.optionAutoTrim.checked ? renderer.Height : renderer.CanvasHeight).toString();
                ui.seqDlPrefix.value = name;
                ui.seqDlNum.value = '0';
                ui.showReadme.style.display = psd.Readme !== '' ? 'block' : 'none';
                //  TODO: error handling
                favorite.psdHash = psd.Hash;
                if (droppedPFV) {
                    var fr_1 = new FileReader();
                    fr_1.onload = function () {
                        favorite.loadFromArrayBuffer(fr_1.result);
                    };
                    fr_1.readAsArrayBuffer(droppedPFV);
                }
                else {
                    if (!favorite.loadFromLocalStorage(psd.Hash)) {
                        if (psd.PFV !== '') {
                            favorite.loadFromString(psd.PFV);
                        }
                    }
                }
                psdRoot = psd;
                ui.redraw();
                deferred.resolve();
            }
            catch (e) {
                deferred.reject(e);
            }
        }, 0);
        return deferred.promise;
    }
    function render(callback) {
        var autoTrim = ui.optionAutoTrim.checked;
        var scale = 1;
        var px = parseInt(ui.maxPixels.value, 10);
        var w = autoTrim ? renderer.Width : renderer.CanvasWidth;
        var h = autoTrim ? renderer.Height : renderer.CanvasHeight;
        switch (ui.fixedSide.value) {
            case 'w':
                if (w > px) {
                    scale = px / w;
                }
                break;
            case 'h':
                if (h > px) {
                    scale = px / h;
                }
                break;
        }
        if (w * scale < 1 || h * scale < 1) {
            if (w > h) {
                scale = 1 / h;
            }
            else {
                scale = 1 / w;
            }
        }
        renderer.render(scale, autoTrim, ui.invertInput.checked, callback);
    }
    function cleanForFilename(f) {
        return f.replace(/[\x00-\x1f\x22\x2a\x2f\x3a\x3c\x3e\x3f\x7c\x7f]+/g, '_');
    }
    function formateDate(d) {
        var s = d.getFullYear() + '-';
        s += ('0' + (d.getMonth() + 1)).slice(-2) + '-';
        s += ('0' + d.getDate()).slice(-2) + ' ';
        s += ('0' + d.getHours()).slice(-2) + ':';
        s += ('0' + d.getMinutes()).slice(-2) + ':';
        s += ('0' + d.getSeconds()).slice(-2);
        return s;
    }
    function pfvOnDrop(files) {
        leaveReaderMode();
        var i, ext;
        for (i = 0; i < files.length; ++i) {
            ext = files[i].name.substring(files[i].name.length - 4).toLowerCase();
            if (ext === '.pfv') {
                // TODO: error handling
                var fr = new FileReader();
                fr.onload = function (e) {
                    if (favorite.loadFromArrayBuffer(fr.result)) {
                        jQuery('#import-dialog').modal('hide');
                    }
                };
                fr.readAsArrayBuffer(files[i]);
                return;
            }
        }
    }
    function getInputElement(query) {
        var elem = document.querySelector(query);
        if (elem instanceof HTMLInputElement) {
            return elem;
        }
        throw new Error('element not found ' + query);
    }
    function initFavoriteUI() {
        var _this = this;
        favorite = new Favorite.Favorite(document.getElementById('favorite-tree'), document.getElementById('favorite-tree').getAttribute('data-root-name'));
        favorite.onClearSelection = function () { return leaveReaderMode(); };
        favorite.onSelect = function (item) {
            if (item.type !== 'item') {
                leaveReaderMode();
                return;
            }
            try {
                var filter = void 0;
                for (var _i = 0, _a = favorite.getParents(item); _i < _a.length; _i++) {
                    var p = _a[_i];
                    if (p.type === 'filter') {
                        filter = p.data.value;
                        break;
                    }
                }
                enterReaderMode(item.data.value, filter, item.text + '.png');
            }
            catch (e) {
                console.error(e);
                alert(e);
            }
        };
        favorite.onDoubleClick = function (item) {
            try {
                switch (item.type) {
                    case 'item':
                        var filter = void 0;
                        for (var _i = 0, _a = favorite.getParents(item); _i < _a.length; _i++) {
                            var p = _a[_i];
                            if (p.type === 'filter') {
                                filter = p.data.value;
                                break;
                            }
                        }
                        leaveReaderMode(item.data.value, filter);
                        break;
                    case 'folder':
                    case 'filter':
                        ui.filterEditingTarget = item;
                        var dialog = jQuery('#filter-dialog');
                        if (!dialog.data('bs.modal')) {
                            dialog.modal();
                        }
                        else {
                            dialog.modal('show');
                        }
                        break;
                }
            }
            catch (e) {
                console.error(e);
                alert(e);
            }
        };
        jQuery('button[data-psdtool-tree-add-item]').on('click', function (e) {
            leaveReaderMode();
            favorite.add('item', true, '', layerRoot.serialize(false));
        });
        Mousetrap.bind('mod+b', function (e) {
            e.preventDefault();
            var text = prompt(document.querySelector('button[data-psdtool-tree-add-item]').getAttribute('data-caption'), '');
            if (text === null || text === '') {
                return;
            }
            leaveReaderMode();
            favorite.add('item', false, text, layerRoot.serialize(false));
        });
        jQuery('button[data-psdtool-tree-add-folder]').on('click', function (e) {
            favorite.add('folder', true);
        });
        Mousetrap.bind('mod+d', function (e) {
            e.preventDefault();
            var text = prompt(document.querySelector('button[data-psdtool-tree-add-folder]').getAttribute('data-caption'), '');
            if (text === null || text === '') {
                return;
            }
            favorite.clearSelection();
            favorite.add('folder', false, text);
        });
        jQuery('button[data-psdtool-tree-rename]').on('click', function (e) { return favorite.edit(); });
        Mousetrap.bind('f2', function (e) {
            e.preventDefault();
            favorite.edit();
        });
        jQuery('button[data-psdtool-tree-remove]').on('click', function (e) { return favorite.remove(); });
        Mousetrap.bind('shift+mod+g', function (e) {
            var target = e.target;
            if (target instanceof HTMLElement && target.classList.contains('psdtool-layer-visible')) {
                e.preventDefault();
                if (!target.classList.contains('psdtool-layer-radio')) {
                    return;
                }
                if (target instanceof HTMLInputElement) {
                    var old = layerRoot.serialize(true);
                    var created = [];
                    var n = void 0;
                    var elems = document.querySelectorAll('input[name="' + target.name + '"].psdtool-layer-radio');
                    for (var i = 0; i < elems.length; ++i) {
                        n = layerRoot.nodes[parseInt(elems[i].getAttribute('data-seq'), 10)];
                        n.checked = true;
                        favorite.add('item', false, n.displayName, layerRoot.serialize(false));
                        created.push(n.displayName);
                    }
                    layerRoot.deserialize(old);
                    ui.redraw();
                    alert(created.length + ' favorite item(s) has been added.\n\n' + created.join('\n'));
                }
            }
        });
        initDropZone('pfv-dropzone', pfvOnDrop);
        initDropZone('pfv-dropzone2', pfvOnDrop);
        jQuery('#import-dialog').on('shown.bs.modal', function (e) {
            // build the recent list
            var recents = document.getElementById('pfv-recents');
            removeAllChild(recents);
            var pfvs = [], btn;
            if ('psdtool_pfv' in localStorage) {
                pfvs = JSON.parse(localStorage['psdtool_pfv']);
            }
            for (var i = pfvs.length - 1; i >= 0; --i) {
                btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'list-group-item';
                if (pfvs[i].hash === psdRoot.Hash) {
                    btn.className += ' list-group-item-info';
                }
                btn.setAttribute('data-dismiss', 'modal');
                (function (btn, data, uniqueId) {
                    btn.addEventListener('click', function (e) {
                        leaveReaderMode();
                        // TODO: error handling
                        favorite.loadFromString(data, uniqueId);
                    }, false);
                })(btn, pfvs[i].data, pfvs[i].id);
                btn.appendChild(document.createTextNode(Favorite.countEntries(pfvs[i].data) +
                    ' item(s) / Created at ' +
                    formateDate(new Date(pfvs[i].time))));
                recents.appendChild(btn);
            }
        });
        var updateFilter = function () {
            var node = ui.filterEditingTarget;
            if (!ui.useFilter.checked) {
                favorite.update({ id: node.id, type: 'folder' });
                favorite.updateLocalStorage();
                return;
            }
            var s = filterRoot.serialize();
            if (!s) {
                favorite.update({ id: node.id, type: 'folder' });
                favorite.updateLocalStorage();
                return;
            }
            favorite.update({ id: node.id, type: 'filter', data: { value: s } });
            favorite.updateLocalStorage();
        };
        ui.useFilter = getInputElement('#use-filter');
        ui.useFilter.addEventListener('click', function (e) {
            var inp = e.target;
            if (inp instanceof HTMLInputElement) {
                if (inp.checked) {
                    ui.filterTree.classList.remove('disabled');
                }
                else {
                    ui.filterTree.classList.add('disabled');
                }
                updateFilter();
            }
        }, false);
        var elem = document.getElementById('filter-tree');
        if (elem instanceof HTMLUListElement) {
            ui.filterTree = elem;
        }
        else {
            throw new Error('element not found #filter-tree');
        }
        ui.filterTree.addEventListener('click', function (e) {
            var inp = e.target;
            if (inp instanceof HTMLInputElement) {
                var li = inp.parentElement;
                while (li && li.tagName !== 'LI') {
                    li = li.parentElement;
                }
                if (inp.checked) {
                    li.classList.add('checked');
                }
                else {
                    li.classList.remove('checked');
                }
                updateFilter();
            }
        }, false);
        jQuery('#filter-dialog').on('shown.bs.modal', function (e) {
            var parents = [];
            for (var _i = 0, _a = favorite.getParents(ui.filterEditingTarget); _i < _a.length; _i++) {
                var p = _a[_i];
                if (p.type === 'filter') {
                    parents.push(p.data.value);
                }
            }
            if (ui.filterEditingTarget.type === 'filter') {
                ui.useFilter.checked = true;
                ui.filterTree.classList.remove('disabled');
                filterRoot.deserialize(ui.filterEditingTarget.data.value, parents);
            }
            else {
                ui.useFilter.checked = false;
                ui.filterTree.classList.add('disabled');
                filterRoot.deserialize('', parents);
            }
            var inputs = ui.filterTree.querySelectorAll('input');
            for (var i = 0, elem_1, li = void 0; i < inputs.length; ++i) {
                elem_1 = inputs[i];
                li = elem_1.parentElement;
                while (li && li.tagName !== 'LI') {
                    li = li.parentElement;
                }
                if (elem_1.disabled) {
                    li.classList.add('disabled');
                }
                else {
                    li.classList.remove('disabled');
                }
                if (elem_1.checked) {
                    li.classList.add('checked');
                }
                else {
                    li.classList.remove('checked');
                }
            }
        });
        jQuery('#bulk-create-folder-dialog').on('shown.bs.modal', function (e) { return ui.bulkCreateFolderTextarea.focus(); });
        var e = document.getElementById('bulk-create-folder-textarea');
        if (e instanceof HTMLTextAreaElement) {
            ui.bulkCreateFolderTextarea = e;
        }
        else {
            throw new Error('element not found: #bulk-create-folder-textarea');
        }
        document.getElementById('bulk-create-folder').addEventListener('click', function (e) {
            var folders = [];
            for (var _i = 0, _a = ui.bulkCreateFolderTextarea.value.replace(/\r/g, '').split('\n'); _i < _a.length; _i++) {
                var line = _a[_i];
                line = line.trim();
                if (line === '') {
                    continue;
                }
                folders.push(line);
            }
            favorite.addFolders(folders);
            ui.bulkCreateFolderTextarea.value = '';
        }, false);
        jQuery('#bulk-rename-dialog').on('shown.bs.modal', function (e) {
            var r = function (ul, nodes) {
                var cul;
                var li;
                var input;
                for (var _i = 0, nodes_1 = nodes; _i < nodes_1.length; _i++) {
                    var n = nodes_1[_i];
                    input = document.createElement('input');
                    input.className = 'form-control';
                    input.value = n.text;
                    (function (input, n) {
                        input.onblur = function (e) { n.text = input.value.trim(); };
                    })(input, n);
                    li = document.createElement('li');
                    li.appendChild(input);
                    cul = document.createElement('ul');
                    li.appendChild(cul);
                    r(cul, n.children);
                    ul.appendChild(li);
                }
            };
            var elem = document.getElementById('bulk-rename-tree');
            ui.bulkRenameData = favorite.renameNodes;
            removeAllChild(elem);
            r(elem, ui.bulkRenameData);
        });
        document.getElementById('bulk-rename').addEventListener('click', function (e) {
            favorite.bulkRename(ui.bulkRenameData);
        }, false);
        document.getElementById('export-favorites-pfv').addEventListener('click', function (e) {
            saveAs(new Blob([favorite.pfv], {
                type: 'text/plain'
            }), cleanForFilename(favorite.rootName) + '.pfv');
        }, false);
        document.getElementById('export-favorites-zip').addEventListener('click', function (e) {
            var parents = [];
            var path = [], files = [];
            var r = function (children) {
                for (var _i = 0, children_1 = children; _i < children_1.length; _i++) {
                    var item = children_1[_i];
                    path.push(cleanForFilename(item.text));
                    switch (item.type) {
                        case 'root':
                            path.pop();
                            r(item.children);
                            path.push('');
                            break;
                        case 'folder':
                            parents.unshift(item);
                            r(item.children);
                            parents.shift();
                            break;
                        case 'filter':
                            parents.unshift(item);
                            r(item.children);
                            parents.shift();
                            break;
                        case 'item':
                            var filter = void 0;
                            for (var _a = 0, parents_1 = parents; _a < parents_1.length; _a++) {
                                var p = parents_1[_a];
                                if (p.type === 'filter') {
                                    filter = p.data.value;
                                    break;
                                }
                            }
                            if (filter) {
                                files.push({
                                    name: path.join('\\') + '.png',
                                    value: item.data.value,
                                    filter: filter
                                });
                            }
                            else {
                                files.push({
                                    name: path.join('\\') + '.png',
                                    value: item.data.value
                                });
                            }
                            break;
                        default:
                            throw new Error('unknown item type: ' + item.type);
                    }
                    path.pop();
                }
            };
            var json = favorite.json;
            r(json);
            var backup = layerRoot.serialize(true);
            var z = new Zipper.Zipper();
            var progressBar = document.getElementById('export-progress-dialog-progress-bar');
            var progressCaption = document.getElementById('export-progress-dialog-progress-caption');
            var reportProgress = updateProgress.bind(_this, progressBar, progressCaption);
            var aborted = false;
            var errorHandler = function (readableMessage, err) {
                z.dispose(function (err) { return undefined; });
                console.error(err);
                if (!aborted) {
                    alert(readableMessage + ': ' + err);
                }
                jQuery('#export-progress-dialog').modal('hide');
            };
            // it is needed to avoid alert storm when reload during exporting.
            window.addEventListener('unload', function () { aborted = true; }, false);
            var added = 0;
            var addedHandler = function () {
                if (++added < files.length + 1) {
                    reportProgress(added / (files.length + 1), added === 1 ? 'drawing...' : '(' + added + '/' + files.length + ') ' + files[added - 1].name);
                    return;
                }
                layerRoot.deserialize(backup);
                reportProgress(1, 'building a zip...');
                z.generate(function (blob) {
                    jQuery('#export-progress-dialog').modal('hide');
                    saveAs(blob, cleanForFilename(favorite.rootName) + '.zip');
                    z.dispose(function (err) { return undefined; });
                }, errorHandler.bind(_this, 'cannot create a zip archive'));
            };
            z.init(function () {
                z.add('favorites.pfv', new Blob([favorite.pfv], { type: 'text/plain; charset=utf-8' }), addedHandler, errorHandler.bind(_this, 'cannot write pfv to a zip archive'));
                var i = 0;
                var process = function () {
                    if ('filter' in files[i]) {
                        layerRoot.deserializePartial('', files[i].value, files[i].filter);
                    }
                    else {
                        layerRoot.deserialize(files[i].value);
                    }
                    render(function (progress, canvas) {
                        if (progress !== 1) {
                            return;
                        }
                        z.add(files[i].name, new Blob([dataSchemeURIToArrayBuffer(canvas.toDataURL())], { type: 'image/png' }), addedHandler, errorHandler.bind(_this, 'cannot write png to a zip archive'));
                        if (++i < files.length) {
                            setTimeout(process, 0);
                        }
                    });
                };
                process();
            }, errorHandler.bind(_this, 'cannot create a zip archive'));
            var dialog = jQuery('#export-progress-dialog');
            if (!dialog.data('bs.modal')) {
                dialog.modal();
            }
            else {
                dialog.modal('show');
            }
        }, false);
        document.getElementById('export-layer-structure').addEventListener('click', function (e) {
            saveAs(new Blob([layerRoot.text], {
                type: 'text/plain'
            }), 'layer.txt');
        }, false);
    }
    function dataSchemeURIToArrayBuffer(str) {
        var bin = atob(str.substring(str.indexOf(',') + 1));
        var buf = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; ++i) {
            buf[i] = bin.charCodeAt(i);
        }
        return buf.buffer;
    }
    function normalizeNumber(s) {
        return s.replace(/[\uff10-\uff19]/g, function (m) {
            return (m[0].charCodeAt(0) - 0xff10).toString();
        });
    }
    function initUI() {
        var _this = this;
        ui.optionAutoTrim = getInputElement('#option-auto-trim');
        ui.optionSafeMode = getInputElement('#option-safe-mode');
        // save and restore scroll position of side-body on each tab.
        ui.favoriteToolbar = document.getElementById('favorite-toolbar');
        ui.sideBody = document.getElementById('side-body');
        ui.sideBody.addEventListener('scroll', function (e) {
            ui.favoriteToolbar.style.top = ui.sideBody.scrollTop + 'px';
        }, false);
        ui.sideBodyScrollPos = {};
        jQuery('a[data-toggle="tab"]').on('hide.bs.tab', function (e) {
            var tab = e.target.getAttribute('href');
            ui.sideBodyScrollPos[tab] = {
                left: ui.sideBody.scrollLeft,
                top: ui.sideBody.scrollTop
            };
        }).on('shown.bs.tab', function (e) {
            var tab = e.target.getAttribute('href');
            if (tab in ui.sideBodyScrollPos) {
                ui.sideBody.scrollLeft = ui.sideBodyScrollPos[tab].left;
                ui.sideBody.scrollTop = ui.sideBodyScrollPos[tab].top;
            }
            resized();
        });
        jQuery('a[data-toggle="tab"][href="#layer-tree-pane"]').on('show.bs.tab', function (e) {
            leaveReaderMode();
        });
        initFavoriteUI();
        ui.previewBackground = document.getElementById('preview-background');
        var elem = document.getElementById('preview');
        if (elem instanceof HTMLCanvasElement) {
            ui.previewCanvas = elem;
        }
        else {
            throw new Error('element not found: #preview');
        }
        ui.previewCanvas.addEventListener('dragstart', function (e) {
            var s = _this.toDataURL();
            var name = _this.getAttribute('data-filename');
            if (name) {
                var p = s.indexOf(';');
                s = s.substring(0, p) + ';filename=' + encodeURIComponent(name) + s.substring(p);
            }
            e.dataTransfer.setData('text/uri-list', s);
            e.dataTransfer.setData('text/plain', s);
        }, false);
        ui.redraw = function () {
            ui.seqDl.disabled = true;
            render(function (progress, canvas) {
                ui.previewBackground.style.width = canvas.width + 'px';
                ui.previewBackground.style.height = canvas.height + 'px';
                ui.seqDl.disabled = progress !== 1;
                ui.previewCanvas.draggable = progress === 1;
                setTimeout(function () {
                    ui.previewCanvas.width = canvas.width;
                    ui.previewCanvas.height = canvas.height;
                    ui.previewCanvas.getContext('2d').drawImage(canvas, 0, 0);
                }, 0);
            });
            layerRoot.updateClass();
        };
        ui.save = function (filename) { return saveAs(new Blob([
            dataSchemeURIToArrayBuffer(ui.previewCanvas.toDataURL())
        ], { type: 'image/png' }), filename); };
        elem = document.getElementById('show-readme');
        if (elem instanceof HTMLButtonElement) {
            ui.showReadme = elem;
        }
        else {
            throw new Error('element not found: #show-readme');
        }
        ui.showReadme.addEventListener('click', function (e) {
            var w = window.open('', null);
            w.document.body.innerHTML = '<title>Readme - PSDTool</title><pre style="font: 12pt/1.7 monospace;"></pre>';
            w.document.querySelector('pre').textContent = psdRoot.Readme;
        }, false);
        jQuery('#main').on('splitpaneresize', resized).splitPane();
        ui.invertInput = getInputElement('#invert-input');
        ui.invertInput.addEventListener('click', function (e) { return ui.redraw(); }, false);
        elem = document.getElementById('fixed-side');
        if (elem instanceof HTMLSelectElement) {
            ui.fixedSide = elem;
        }
        else {
            throw new Error('element not found: #fixed-side');
        }
        ui.fixedSide.addEventListener('change', function (e) { return ui.redraw(); }, false);
        var lastPx;
        ui.maxPixels = getInputElement('#max-pixels');
        ui.maxPixels.addEventListener('blur', function (e) {
            var v = normalizeNumber(ui.maxPixels.value);
            if (v === lastPx) {
                return;
            }
            lastPx = v;
            ui.maxPixels.value = v;
            ui.redraw();
        }, false);
        ui.seqDlPrefix = getInputElement('#seq-dl-prefix');
        ui.seqDlNum = getInputElement('#seq-dl-num');
        elem = document.getElementById('seq-dl');
        if (elem instanceof HTMLButtonElement) {
            ui.seqDl = elem;
        }
        else {
            throw new Error('element not found: #seq-dl');
        }
        ui.seqDl.addEventListener('click', function (e) {
            var prefix = ui.seqDlPrefix.value;
            if (ui.seqDlNum.value === '') {
                ui.save(prefix + '.png');
                return;
            }
            var num = parseInt(normalizeNumber(ui.seqDlNum.value), 10);
            if (num < 0) {
                num = 0;
            }
            if (ui.save(prefix + ('0000' + num).slice(-4) + '.png')) {
                ui.seqDlNum.value = (num + 1).toString();
            }
        }, false);
        Mousetrap.pause();
    }
    function enterReaderMode(state, filter, filename) {
        if (!ui.previewBackground.classList.contains('reader')) {
            ui.previewBackground.classList.add('reader');
            ui.normalModeState = layerRoot.serialize(true);
        }
        if (!filter) {
            layerRoot.deserialize(state);
        }
        else {
            layerRoot.deserializePartial(ui.normalModeState, state, filter);
        }
        if (filename) {
            ui.previewCanvas.setAttribute('data-filename', filename);
        }
        ui.redraw();
    }
    function leaveReaderMode(state, filter) {
        if (ui.previewBackground.classList.contains('reader')) {
            ui.previewBackground.classList.remove('reader');
        }
        if (state) {
            ui.previewCanvas.removeAttribute('data-filename');
            if (!filter) {
                layerRoot.deserialize(state);
            }
            else {
                if (ui.normalModeState) {
                    layerRoot.deserializePartial(ui.normalModeState, state, filter);
                }
                else {
                    layerRoot.deserializePartial(undefined, state, filter);
                }
            }
        }
        else if (ui.normalModeState) {
            ui.previewCanvas.removeAttribute('data-filename');
            layerRoot.deserialize(ui.normalModeState);
        }
        else {
            return;
        }
        ui.redraw();
        ui.normalModeState = null;
    }
    function initDropZone(dropZoneId, loader) {
        var dz = document.getElementById(dropZoneId);
        dz.addEventListener('dragenter', function (e) {
            dz.classList.add('psdtool-drop-active');
            e.preventDefault();
            e.stopPropagation();
            return false;
        }, false);
        dz.addEventListener('dragover', function (e) {
            dz.classList.add('psdtool-drop-active');
            e.preventDefault();
            e.stopPropagation();
            return false;
        }, false);
        dz.addEventListener('dragleave', function (e) {
            dz.classList.remove('psdtool-drop-active');
            e.preventDefault();
            e.stopPropagation();
            return false;
        }, false);
        dz.addEventListener('drop', function (e) {
            dz.classList.remove('psdtool-drop-active');
            if (e.dataTransfer.files.length > 0) {
                loader(e.dataTransfer.files);
            }
            e.preventDefault();
            e.stopPropagation();
            return false;
        }, false);
        var f = dz.querySelector('input[type=file]');
        if (f instanceof HTMLInputElement) {
            f.addEventListener('change', function (e) {
                loader(f.files);
                f.value = null;
            }, false);
        }
    }
    document.addEventListener('DOMContentLoaded', init, false);
})();
