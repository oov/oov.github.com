/// <reference path="../typings/browser.d.ts" />
/// <reference path="downscaler.ts" />
/// <reference path="renderer.ts" />
'use strict';
(function (Mousetrap) {
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
})(Mousetrap);
(function () {
    var ui = {
        redraw: null,
        save: null,
        maxPixels: null,
        optionAutoTrim: null,
        optionSafeMode: null,
        seqDlPrefix: null,
        seqDlNum: null,
        favoriteToolbar: null,
        favoriteTree: null,
        FavoriteTreeDefaultRootName: null,
        favoriteTreeChangedTimer: null,
        seqDl: null,
        exportFavoritesPFV: null,
        exportFavoritesZIP: null,
        sideBody: null,
        sideBodyScrollPos: null,
        previewCanvas: null,
        previewBackground: null,
        showReadme: null,
        invertInput: null,
        fixedSide: null,
        exportProgressDialog: null,
        exportProgressDialogProgressBar: null,
        exportProgressDialogProgressCaption: null,
        normalModeState: null
    };
    var renderer;
    var psdRoot;
    var droppedPFV, uniqueId = Date.now().toString() + Math.random().toString().substring(2);
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
            loadAndParse(document.getElementById('samplefile').getAttribute('data-filename'));
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
        ui.favoriteTree[0].style.paddingTop = ui.favoriteToolbar.clientHeight + 'px';
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
        function progress(phase, progress) {
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
        }
        progress('prepare', 0);
        loadAsArrayBuffer(progress, file_or_url)
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
    function loadAsArrayBuffer(progress, file_or_url) {
        var deferred = m.deferred();
        progress('prepare', 0);
        if (typeof file_or_url === 'string') {
            var crossDomain = false;
            if (file_or_url.substring(0, 3) === 'xd:') {
                file_or_url = file_or_url.substring(3);
                crossDomain = true;
            }
            if (location.protocol === 'https:' && file_or_url.substring(0, 5) === 'http:') {
                setTimeout(function () {
                    deferred.reject(new Error('cannot access to the insecure content from HTTPS.'));
                }, 0);
                return deferred.promise;
            }
            if (crossDomain) {
                var ifr = document.createElement('iframe'), port;
                var timer = setTimeout(function () {
                    port.onmessage = null;
                    document.body.removeChild(ifr);
                    deferred.reject(new Error('something went wrong'));
                }, 20000);
                ifr.sandbox = 'allow-scripts allow-same-origin';
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
                                    name: e.data.name ? e.data.name : extractFilePrefixFromUrl(file_or_url)
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
                    ifr.contentWindow.postMessage(location.protocol, file_or_url.replace(/^([^:]+:\/\/[^\/]+).*$/, '$1'), [msgCh.port2]);
                };
                ifr.src = file_or_url;
                ifr.style.display = 'none';
                document.body.appendChild(ifr);
                return deferred.promise;
            }
            var xhr = new XMLHttpRequest();
            xhr.open('GET', file_or_url);
            xhr.responseType = 'arraybuffer';
            xhr.onload = function (e) {
                progress('receive', 1);
                if (xhr.status === 200) {
                    deferred.resolve({
                        buffer: xhr.response,
                        name: extractFilePrefixFromUrl(file_or_url)
                    });
                    return;
                }
                deferred.reject(new Error(xhr.status + ' ' + xhr.statusText));
            };
            xhr.onerror = function (e) {
                console.error(e);
                deferred.reject(new Error('could not receive data'));
            };
            xhr.onprogress = function (e) {
                progress('receive', e.loaded / e.total);
            };
            xhr.send(null);
            return deferred.promise;
        }
        setTimeout(function () {
            deferred.resolve({
                buffer: file_or_url,
                name: file_or_url.name.replace(/\..*$/i, '') + '_'
            });
        }, 0);
        return deferred.promise;
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
        PSD.parseWorker(obj.buffer, progress, function (psd, canvasMap) {
            deferred.resolve({ psd: psd, canvasMap: canvasMap, name: obj.name });
        }, function (error) { deferred.reject(error); });
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
                renderer = new Renderer(psd);
                buildLayerTree(renderer, function () { ui.redraw(); });
                ui.maxPixels.value = ui.optionAutoTrim.checked ? renderer.Height : renderer.CanvasHeight;
                ui.seqDlPrefix.value = name;
                ui.seqDlNum.value = 0;
                ui.showReadme.style.display = psd.Readme !== '' ? 'block' : 'none';
                loadPFVFromDroppedFile().then(function (loaded) {
                    return loaded ? true : loadPFVFromString(psd.PFV);
                }).then(function (loaded) {
                    return loaded ? true : loadPFVFromLocalStorage(psd.Hash);
                }).then(null, function (e) {
                    console.error(e);
                    alert(e);
                });
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
    function updateClass() {
        function r(n) {
            if (n.visible) {
                n.userData.li.classList.remove('psdtool-hidden');
                if (n.clip) {
                    for (var i = 0; i < n.clip.length; ++i) {
                        n.clip[i].userData.li.classList.remove('psdtool-hidden-by-clipping');
                    }
                }
            }
            else {
                n.userData.li.classList.add('psdtool-hidden');
                if (n.clip) {
                    for (var i = 0; i < n.clip.length; ++i) {
                        n.clip[i].userData.li.classList.add('psdtool-hidden-by-clipping');
                    }
                }
            }
            for (var i = 0; i < n.children.length; ++i) {
                r(n.children[i]);
            }
        }
        for (var i = 0; i < renderer.StateTreeRoot.children.length; ++i) {
            r(renderer.StateTreeRoot.children[i]);
        }
    }
    function favoriteTreeChanged() {
        if (ui.favoriteTreeChangedTimer) {
            clearTimeout(ui.favoriteTreeChangedTimer);
        }
        ui.favoriteTreeChangedTimer = setTimeout(function () {
            ui.favoriteTreeChangedTimer = null;
            var pfv = buildPFV(ui.favoriteTree.jstree('get_json'));
            var pfvs = [];
            if ('psdtool_pfv' in localStorage) {
                pfvs = JSON.parse(localStorage['psdtool_pfv']);
            }
            var found = false;
            for (var i = 0; i < pfvs.length; ++i) {
                if (pfvs[i].id === uniqueId && pfvs[i].hash === psdRoot.Hash) {
                    pfvs.splice(i, 1);
                    found = true;
                    break;
                }
            }
            if (!found && countPFVEntries(pfv) === 0) {
                return;
            }
            pfvs.push({
                id: uniqueId,
                time: new Date().getTime(),
                hash: psdRoot.Hash,
                data: pfv
            });
            while (pfvs.length > 8) {
                pfvs.shift();
            }
            localStorage['psdtool_pfv'] = JSON.stringify(pfvs);
        }, 100);
    }
    function initFavoriteTree(data) {
        var treeSettings = {
            core: {
                animation: false,
                check_callback: function (op, node, parent) {
                    switch (op) {
                        case 'create_node':
                            return node.type !== 'root';
                        case 'rename_node':
                            return true;
                        case 'delete_node':
                            return node.type !== 'root';
                        case 'move_node':
                            return node.type !== 'root' && parent.id !== '#' && parent.type !== 'item';
                        case 'copy_node':
                            return node.type !== 'root' && parent.id !== '#' && parent.type !== 'item';
                    }
                },
                dblclick_toggle: false,
                themes: {
                    dots: false
                },
                data: data ? data : [{
                        id: 'root',
                        text: ui.FavoriteTreeDefaultRootName,
                        type: 'root',
                    }]
            },
            types: {
                root: {
                    icon: false,
                },
                item: {
                    icon: 'glyphicon glyphicon-picture'
                },
                folder: {
                    icon: 'glyphicon glyphicon-folder-open'
                },
                filter: {
                    icon: 'glyphicon glyphicon-filter'
                }
            },
            plugins: ['types', 'dnd', 'wholerow'],
        };
        if (ui.favoriteTree) {
            ui.favoriteTree.jstree('destroy');
        }
        ui.favoriteTree = jQuery('#favorite-tree').jstree(treeSettings);
        ui.favoriteTree.on([
            'set_text.jstree',
            'create_node.jstree',
            'rename_node.jstree',
            'delete_node.jstree',
            'move_node.jstree',
            'copy_node.jstree',
            'cut.jstree',
            'paste.jstree'
        ].join(' '), favoriteTreeChanged);
        ui.favoriteTree.on('changed.jstree', function (e) {
            var jst = $(this).jstree();
            var selectedList = jst.get_top_selected(true);
            if (selectedList.length === 0) {
                return;
            }
            var selected = selectedList[0];
            if (selected.type !== 'item') {
                leaveReaderMode();
                return;
            }
            try {
                enterReaderMode(selected.data.value, selected.text + '.png');
            }
            catch (e) {
                console.error(e);
                alert(e);
            }
        });
        ui.favoriteTree.on('copy_node.jstree', function (e, data) {
            var jst = $(this).jstree();
            function process(node, original) {
                var text = suggestUniqueName(jst, node);
                if (node.text !== text) {
                    jst.rename_node(node, text);
                }
                switch (node.type) {
                    case 'item':
                        node.data = {};
                        if ('value' in original.data) {
                            node.data.value = original.data.value;
                        }
                        break;
                    case 'folder':
                        for (var i = 0; i < node.children.length; ++i) {
                            process(jst.get_node(node.children[i]), jst.get_node(original.children[i]));
                        }
                        break;
                    case 'filter':
                        for (var i = 0; i < node.children.length; ++i) {
                            process(jst.get_node(node.children[i]), jst.get_node(original.children[i]));
                        }
                        break;
                }
            }
            process(data.node, data.original);
        });
        ui.favoriteTree.on('move_node.jstree', function (e, data) {
            var jst = $(this).jstree();
            var text = suggestUniqueName(jst, data.node, data.text);
            if (data.text !== text) {
                jst.rename_node(data.node, text);
            }
        });
        ui.favoriteTree.on('create_node.jstree', function (e, data) {
            var jst = $(this).jstree();
            var text = suggestUniqueName(jst, data.node);
            if (data.node.text !== text) {
                jst.rename_node(data.node, text);
            }
        });
        ui.favoriteTree.on('rename_node.jstree', function (e, data) {
            var jst = $(this).jstree();
            var text = suggestUniqueName(jst, data.node, data.text);
            if (data.text !== text) {
                jst.rename_node(data.node, text);
            }
        });
        ui.favoriteTree.on('dblclick.jstree', function (e) {
            var jst = $(this).jstree();
            var selected = jst.get_node(e.target);
            if (selected.type !== 'item') {
                jst.toggle_node(selected);
                return;
            }
            try {
                if (selected.data.value) {
                    leaveReaderMode(selected.data.value);
                    return;
                }
            }
            catch (e) {
                console.error(e);
                alert(e);
            }
        });
    }
    function suggestUniqueName(jst, node, newText) {
        var i, n = jst.get_node(node), parent = jst.get_node(n.parent);
        var nameMap = {};
        for (i = 0; i < parent.children.length; ++i) {
            if (parent.children[i] === n.id) {
                continue;
            }
            nameMap[jst.get_text(parent.children[i])] = true;
        }
        if (newText === undefined) {
            newText = n.text;
        }
        if (!(newText in nameMap)) {
            return newText;
        }
        newText += ' ';
        i = 2;
        while ((newText + i) in nameMap) {
            ++i;
        }
        return newText + i;
    }
    function getFavoriteTreeRootName() {
        var jst = ui.favoriteTree.jstree();
        var root = jst.get_node('root');
        if (root && root.text) {
            return root.text;
        }
        return ui.FavoriteTreeDefaultRootName;
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
    function addNewNode(jst, objType, usePrompt) {
        function createNode(obj) {
            var selectedList = jst.get_top_selected(true);
            if (selectedList.length === 0) {
                return jst.create_node('root', obj, 'last');
            }
            var selected = selectedList[0];
            if (selected.type !== 'item') {
                var n = jst.create_node(selected, obj, 'last');
                if (!selected.state.opened) {
                    jst.open_node(selected, null);
                }
                return n;
            }
            var parent = jst.get_node(selected.parent);
            var idx = parent.children.indexOf(selected.id);
            return jst.create_node(parent, obj, idx !== -1 ? idx + 1 : 'last');
        }
        var obj, selector;
        switch (objType) {
            case 'item':
                leaveReaderMode();
                obj = {
                    text: 'New Item',
                    type: 'item',
                    data: {
                        value: serializeCheckState(false)
                    }
                };
                selector = 'button[data-psdtool-tree-add-item]';
                break;
            case 'folder':
                obj = {
                    text: 'New Folder',
                    type: 'folder'
                };
                selector = 'button[data-psdtool-tree-add-folder]';
                break;
            case 'filter':
                obj = {
                    text: 'New Filter',
                    type: 'filter'
                };
                selector = 'button[data-psdtool-tree-add-filter]';
                break;
            default:
                throw new Error('unsupported object type: ' + objType);
        }
        var id = createNode(obj);
        jst.deselect_all();
        jst.select_node(id);
        leaveReaderMode();
        if (!usePrompt) {
            return id;
        }
        var oldText = jst.get_text(id);
        var text = prompt(document.querySelector(selector).getAttribute('data-caption'), oldText);
        if (text === null) {
            removeSelectedNode(jst);
            return;
        }
        text = suggestUniqueName(jst, id, oldText);
        if (text !== oldText) {
            jst.rename_node(id, text);
        }
        return id;
    }
    function removeSelectedNode(jst) {
        leaveReaderMode();
        try {
            jst.delete_node(jst.get_top_selected());
        }
        catch (e) {
            // workaround that an error happens when deletes node during editing.
            jst.delete_node(jst.create_node(null, 'dummy', 'last'));
        }
        leaveReaderMode();
    }
    function pfvOnDrop(files) {
        leaveReaderMode();
        var i, ext;
        for (i = 0; i < files.length; ++i) {
            ext = files[i].name.substring(files[i].name.length - 4).toLowerCase();
            if (ext === '.pfv') {
                loadAsArrayBuffer(function () { return undefined; }, files[i]).then(function (buffer) {
                    loadPFV(arrayBufferToString(buffer.buffer));
                    jQuery('#import-dialog').modal('hide');
                }).then(null, function (e) {
                    console.error(e);
                    alert(e);
                });
                break;
            }
        }
    }
    function initFavoriteUI() {
        ui.FavoriteTreeDefaultRootName = document.getElementById('favorite-tree').getAttribute('data-root-name');
        initFavoriteTree();
        jQuery('button[data-psdtool-tree-add-item]').on('click', function (e) {
            var jst = jQuery(this.getAttribute('data-psdtool-tree-add-item')).jstree();
            jst.edit(addNewNode(jst, 'item', false));
        });
        Mousetrap.bind('mod+b', function (e) {
            e.preventDefault();
            var jst = ui.favoriteTree.jstree();
            addNewNode(jst, 'item', true);
        });
        jQuery('button[data-psdtool-tree-add-folder]').on('click', function (e) {
            var jst = jQuery(this.getAttribute('data-psdtool-tree-add-folder')).jstree();
            jst.edit(addNewNode(jst, 'folder', false));
        });
        Mousetrap.bind('mod+d', function (e) {
            e.preventDefault();
            var jst = ui.favoriteTree.jstree();
            addNewNode(jst, 'folder', true);
        });
        jQuery('button[data-psdtool-tree-rename]').on('click', function (e) {
            var jst = jQuery(this.getAttribute('data-psdtool-tree-rename')).jstree();
            jst.edit(jst.get_top_selected());
        });
        Mousetrap.bind('f2', function (e) {
            e.preventDefault();
            var jst = ui.favoriteTree.jstree();
            jst.edit(jst.get_top_selected());
        });
        jQuery('button[data-psdtool-tree-remove]').on('click', function (e) {
            var jst = jQuery(this.getAttribute('data-psdtool-tree-remove')).jstree();
            removeSelectedNode(jst);
        });
        Mousetrap.bind('shift+mod+g', function (e) {
            var target = e.target;
            if (!target.classList.contains('psdtool-layer-visible')) {
                return;
            }
            e.preventDefault();
            var jst = ui.favoriteTree.jstree();
            if (target.classList.contains('psdtool-layer-radio')) {
                var old = serializeCheckState(true);
                var created = [];
                var elems = document.querySelectorAll('input[name="' + target.name + '"].psdtool-layer-radio');
                for (var i = 0, id = void 0; i < elems.length; ++i) {
                    elems[i].checked = true;
                    id = addNewNode(jst, 'item', false);
                    jst.rename_node(id, elems[i].getAttribute('data-name'));
                    created.push(jst.get_text(id));
                }
                deserializeCheckState(old);
                ui.redraw();
                alert(created.length + ' favorite item(s) has been added.\n\n' + created.join('\n'));
            }
        });
        initDropZone('pfv-dropzone', pfvOnDrop);
        initDropZone('pfv-dropzone2', pfvOnDrop);
        jQuery('#import-dialog').on('shown.bs.modal', function (e) {
            // build the recent list
            var recents = document.getElementById('pfv-recents');
            removeAllChild(recents);
            var pfv = [], btn;
            if ('psdtool_pfv' in localStorage) {
                pfv = JSON.parse(localStorage['psdtool_pfv']);
            }
            for (var i = pfv.length - 1; i >= 0; --i) {
                btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'list-group-item';
                if (pfv[i].hash === psdRoot.Hash) {
                    btn.className += ' list-group-item-info';
                }
                btn.setAttribute('data-dismiss', 'modal');
                (function (btn, data, id) {
                    btn.addEventListener('click', function (e) {
                        leaveReaderMode();
                        loadPFVFromString(data).then(function (loaded) { uniqueId = id; }, function (e) { console.error(e); alert(e); });
                    }, false);
                })(btn, pfv[i].data, pfv[i].id);
                btn.appendChild(document.createTextNode(countPFVEntries(pfv[i].data) +
                    ' item(s) / Created at ' +
                    formateDate(new Date(pfv[i].time))));
                recents.appendChild(btn);
            }
        });
        ui.exportFavoritesPFV = document.getElementById('export-favorites-pfv');
        ui.exportFavoritesPFV.addEventListener('click', function (e) {
            saveAs(new Blob([buildPFV(ui.favoriteTree.jstree('get_json'))], {
                type: 'text/plain'
            }), cleanForFilename(getFavoriteTreeRootName()) + '.pfv');
        });
        ui.exportProgressDialog = jQuery('#export-progress-dialog').modal();
        ui.exportProgressDialogProgressBar = document.getElementById('export-progress-dialog-progress-bar');
        ui.exportProgressDialogProgressCaption = document.getElementById('export-progress-dialog-progress-caption');
        ui.exportFavoritesZIP = document.getElementById('export-favorites-zip');
        ui.exportFavoritesZIP.addEventListener('click', function (e) {
            var path = [], files = [];
            function r(children) {
                for (var i_1 = 0, item = void 0; i_1 < children.length; ++i_1) {
                    item = children[i_1];
                    path.push(cleanForFilename(item.text));
                    switch (item.type) {
                        case 'root':
                            path.pop();
                            r(item.children);
                            path.push('');
                            break;
                        case 'folder':
                            r(item.children);
                            break;
                        case 'filter':
                            r(item.children);
                            break;
                        case 'item':
                            files.push({
                                name: path.join('\\') + '.png',
                                value: item.data.value
                            });
                            break;
                        default:
                            throw new Error('unknown item type: ' + item.type);
                    }
                    path.pop();
                }
            }
            var json = ui.favoriteTree.jstree('get_json');
            r(json);
            var backup = serializeCheckState(true);
            var w = new Worker('js/zipbuilder.js');
            w.onmessage = function (e) {
                if (e.data.error) {
                    console.error(e.data.error);
                    alert('cannot create zip archive: ' + e.data.error);
                    ui.exportProgressDialog.modal('hide');
                    return;
                }
                ui.exportProgressDialog.modal('hide');
                saveAs(new Blob([e.data.buffer], {
                    type: 'application/zip'
                }), cleanForFilename(getFavoriteTreeRootName()) + '.zip');
            };
            w.postMessage({
                method: 'add',
                name: 'favorites.pfv',
                buffer: buildPFV(json)
            });
            var i = 0;
            function process() {
                if (i === files.length) {
                    deserializeCheckState(backup);
                    updateProgress(ui.exportProgressDialogProgressBar, ui.exportProgressDialogProgressCaption, 1, 'building zip...');
                    w.postMessage({
                        method: 'end'
                    });
                    return;
                }
                deserializeCheckState(files[i].value);
                render(function (progress, canvas) {
                    if (progress !== 1) {
                        return;
                    }
                    var b = dataSchemeURIToArrayBuffer(canvas.toDataURL());
                    w.postMessage({
                        method: 'add',
                        name: files[i].name,
                        buffer: b
                    }, [b]);
                    updateProgress(ui.exportProgressDialogProgressBar, ui.exportProgressDialogProgressCaption, i / files.length, '(' + i + '/' + files.length + ') ' + decodeLayerName(files[i].name));
                    ++i;
                    setTimeout(process, 0);
                });
            }
            updateProgress(ui.exportProgressDialogProgressBar, ui.exportProgressDialogProgressCaption, 0, 'drawing...');
            ui.exportProgressDialog.modal('show');
            setTimeout(process, 0);
        });
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
        ui.optionAutoTrim = document.getElementById('option-auto-trim');
        ui.optionSafeMode = document.getElementById('option-safe-mode');
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
        ui.previewCanvas = document.getElementById('preview');
        ui.previewCanvas.addEventListener('dragstart', function (e) {
            var s = this.toDataURL();
            var name = this.getAttribute('data-filename');
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
                ui.previewCanvas.draggable = progress !== 1 ? 'false' : 'true';
                setTimeout(function () {
                    ui.previewCanvas.width = canvas.width;
                    ui.previewCanvas.height = canvas.height;
                    var ctx = ui.previewCanvas.getContext('2d');
                    ctx.drawImage(canvas, 0, 0);
                }, 0);
            });
            updateClass();
        };
        ui.save = function (filename) {
            saveAs(new Blob([
                dataSchemeURIToArrayBuffer(ui.previewCanvas.toDataURL())
            ], {
                type: 'image/png'
            }), filename);
            return true;
        };
        ui.showReadme = document.getElementById('show-readme');
        ui.showReadme.addEventListener('click', function (e) {
            var w = window.open('', null);
            w.document.body.innerHTML = '<title>Readme - PSDTool</title><pre style="font: 12pt/1.7 monospace;"></pre>';
            w.document.querySelector('pre').textContent = psdRoot.Readme;
        }, false);
        jQuery('#main').on('splitpaneresize', resized).splitPane();
        ui.invertInput = document.getElementById('invert-input');
        ui.invertInput.addEventListener('click', function (e) {
            ui.redraw();
        }, false);
        ui.fixedSide = document.getElementById('fixed-side');
        ui.fixedSide.addEventListener('change', function (e) {
            ui.redraw();
        }, false);
        var lastPx;
        ui.maxPixels = document.getElementById('max-pixels');
        ui.maxPixels.addEventListener('blur', function (e) {
            var v = normalizeNumber(ui.maxPixels.value);
            if (v === lastPx) {
                return;
            }
            lastPx = v;
            ui.maxPixels.value = v;
            ui.redraw();
        }, false);
        ui.seqDlPrefix = document.getElementById('seq-dl-prefix');
        ui.seqDlNum = document.getElementById('seq-dl-num');
        ui.seqDl = document.getElementById('seq-dl');
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
                ui.seqDlNum.value = num + 1;
            }
        }, false);
        Mousetrap.pause();
    }
    function enterReaderMode(state, filename) {
        if (!ui.previewBackground.classList.contains('reader')) {
            ui.previewBackground.classList.add('reader');
            ui.normalModeState = serializeCheckState(true);
        }
        deserializeCheckState(state);
        if (filename) {
            ui.previewCanvas.setAttribute('data-filename', filename);
        }
        ui.redraw();
    }
    function leaveReaderMode(state) {
        if (ui.previewBackground.classList.contains('reader')) {
            ui.previewBackground.classList.remove('reader');
        }
        if (state) {
            ui.previewCanvas.removeAttribute('data-filename');
            deserializeCheckState(state);
        }
        else if (ui.normalModeState) {
            ui.previewCanvas.removeAttribute('data-filename');
            deserializeCheckState(ui.normalModeState);
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
        if (f) {
            f.addEventListener('change', function (e) {
                loader(f.files);
                f.value = null;
            }, false);
        }
    }
    function encodeLayerName(s) {
        return s.replace(/[\x00-\x1f\x22\x25\x27\x2f\x5c\x7e\x7f]/g, function (m) {
            return '%' + ('0' + m[0].charCodeAt(0).toString(16)).slice(-2);
        });
    }
    function decodeLayerName(s) {
        return decodeURIComponent(s);
    }
    function buildLayerTree(renderer, redraw) {
        var path = [];
        function r(ul, n) {
            path.push(encodeLayerName(n.layer.Name));
            var li = document.createElement('li');
            if (n.layer.Folder) {
                li.classList.add('psdtool-folder');
            }
            var prop = buildLayerProp(n);
            var input = prop.querySelector('.psdtool-layer-visible');
            input.setAttribute('data-fullpath', path.join('/'));
            n.userData = {
                li: li,
                input: input,
            };
            n.getVisibleState = function () { return input.checked; };
            n.setVisibleState = function (v) { input.checked = v; };
            input.addEventListener('click', function () {
                for (var p = n.parent; p; p = p.parent) {
                    p.visible = true;
                }
                if (n.clippedBy) {
                    n.clippedBy.visible = true;
                }
                redraw();
            }, false);
            li.appendChild(prop);
            var cul = document.createElement('ul');
            for (var i = n.children.length - 1; i >= 0; --i) {
                r(cul, n.children[i]);
            }
            li.appendChild(cul);
            ul.appendChild(li);
            path.pop();
        }
        var ul = document.getElementById('layer-tree');
        removeAllChild(ul);
        for (var i = renderer.StateTreeRoot.children.length - 1; i >= 0; --i) {
            r(ul, renderer.StateTreeRoot.children[i]);
        }
        normalizeCheckState();
    }
    function buildLayerProp(n) {
        var name = document.createElement('label');
        var visible = document.createElement('input');
        var layerName = n.layer.Name;
        if (!ui.optionSafeMode.checked) {
            switch (layerName.charAt(0)) {
                case '!':
                    visible.className = 'psdtool-layer-visible psdtool-layer-force-visible';
                    visible.name = n.id;
                    visible.type = 'checkbox';
                    visible.checked = true;
                    visible.disabled = true;
                    visible.style.display = 'none';
                    layerName = layerName.substring(1);
                    break;
                case '*':
                    visible.className = 'psdtool-layer-visible psdtool-layer-radio';
                    visible.name = 'r_' + n.parent.id;
                    visible.type = 'radio';
                    visible.checked = n.layer.Visible;
                    layerName = layerName.substring(1);
                    break;
                default:
                    visible.className = 'psdtool-layer-visible';
                    visible.name = n.id;
                    visible.type = 'checkbox';
                    visible.checked = n.layer.Visible;
                    break;
            }
        }
        else {
            visible.className = 'psdtool-layer-visible';
            visible.name = n.id;
            visible.type = 'checkbox';
            visible.checked = n.layer.Visible;
        }
        visible.setAttribute('data-name', layerName);
        name.appendChild(visible);
        if (n.layer.Clipping) {
            var clip = document.createElement('img');
            clip.className = 'psdtool-clipped-mark';
            clip.src = 'img/clipped.svg';
            clip.alt = 'clipped mark';
            name.appendChild(clip);
        }
        if (n.layer.Folder) {
            var icon = document.createElement('span');
            icon.className = 'psdtool-icon glyphicon glyphicon-folder-open';
            icon.setAttribute('aria-hidden', 'true');
            name.appendChild(icon);
        }
        else {
            var thumb = document.createElement('canvas');
            thumb.className = 'psdtool-thumbnail';
            thumb.width = 96;
            thumb.height = 96;
            if (n.layer.Canvas) {
                var w = n.layer.Width, h = n.layer.Height;
                if (w > h) {
                    w = thumb.width;
                    h = thumb.width / n.layer.Width * h;
                }
                else {
                    h = thumb.height;
                    w = thumb.height / n.layer.Height * w;
                }
                var ctx = thumb.getContext('2d');
                ctx.drawImage(n.layer.Canvas, (thumb.width - w) / 2, (thumb.height - h) / 2, w, h);
            }
            name.appendChild(thumb);
        }
        name.appendChild(document.createTextNode(layerName));
        var div = document.createElement('div');
        div.className = 'psdtool-layer-name';
        div.appendChild(name);
        return div;
    }
    function normalizeCheckState() {
        var ul = document.getElementById('layer-tree');
        var elems = ul.querySelectorAll('.psdtool-layer-force-visible');
        for (var i = 0; i < elems.length; ++i) {
            elems[i].checked = true;
        }
        var set = {};
        var radios = ul.querySelectorAll('.psdtool-layer-radio');
        for (var i = 0; i < radios.length; ++i) {
            if (radios[i].name in set) {
                continue;
            }
            set[radios[i].name] = 1;
            var rinShibuyas = ul.querySelectorAll('.psdtool-layer-radio[name="' + radios[i].name + '"]:checked');
            if (!rinShibuyas.length) {
                radios[i].checked = true;
                continue;
            }
        }
    }
    function clearCheckState() {
        var elems = document.querySelectorAll('#layer-tree .psdtool-layer-visible:checked');
        for (var i = 0; i < elems.length; ++i) {
            elems[i].checked = false;
        }
        normalizeCheckState();
    }
    function serializeCheckState(allLayer) {
        var elems = document.querySelectorAll('#layer-tree .psdtool-layer-visible:checked');
        var i, s, path = [], pathMap = {};
        for (i = 0; i < elems.length; ++i) {
            s = elems[i].getAttribute('data-fullpath');
            path.push({
                s: s,
                ss: s + '/',
                i: i
            });
            pathMap[s] = true;
        }
        if (allLayer) {
            for (i = 0; i < path.length; ++i) {
                path[i] = '/' + path[i].s;
            }
            return path.join('\n');
        }
        path.sort(function (a, b) {
            return a.ss > b.ss ? 1 : a.ss < b.ss ? -1 : 0;
        });
        var j, parts;
        for (i = 0; i < path.length; ++i) {
            // remove hidden layer
            // TODO: need more better handing for clipping masked layer
            parts = path[i].s.split('/');
            for (j = 0; j < parts.length; ++j) {
                if (!pathMap[parts.slice(0, j + 1).join('/')]) {
                    path.splice(i--, 1);
                    j = -1;
                    break;
                }
            }
            // remove duplicated entry
            if (j !== -1 && i > 0 && path[i].ss.indexOf(path[i - 1].ss) === 0) {
                path.splice(--i, 1);
            }
        }
        path.sort(function (a, b) {
            return a.i > b.i ? 1 : a.i < b.i ? -1 : 0;
        });
        for (i = 0; i < path.length; ++i) {
            path[i] = path[i].s;
        }
        return path.join('\n');
    }
    function deserializeCheckState(state) {
        function buildStateTree(state) {
            var allLayer = state.charAt(0) === '/';
            var stateTree = {
                allLayer: allLayer,
                children: {}
            };
            var i, j, obj, node, parts, part;
            var lines = state.replace(/\r/g, '').split('\n');
            for (i = 0; i < lines.length; ++i) {
                parts = lines[i].split('/');
                for (j = allLayer ? 1 : 0, node = stateTree; j < parts.length; ++j) {
                    part = decodeLayerName(parts[j]);
                    if (!(part in node.children)) {
                        obj = {
                            children: {}
                        };
                        if (!allLayer || (allLayer && j === parts.length - 1)) {
                            obj.checked = true;
                        }
                        node.children[part] = obj;
                    }
                    node = node.children[part];
                }
            }
            return stateTree;
        }
        function apply(stateNode, n, allLayer) {
            if (allLayer === undefined) {
                allLayer = stateNode.allLayer;
                if (allLayer) {
                    clearCheckState();
                }
            }
            var cn, stateChild, founds = {};
            for (var i = 0; i < n.children.length; ++i) {
                cn = n.children[i];
                if (cn.layer.Name in founds) {
                    throw new Error('found more than one same name layer: ' + cn.layer.Name);
                }
                founds[cn.layer.Name] = true;
                stateChild = stateNode.children[cn.layer.Name];
                if (!stateChild) {
                    cn.visible = false;
                    continue;
                }
                if ('checked' in stateChild) {
                    cn.visible = stateChild.checked;
                }
                if (allLayer || stateChild.checked) {
                    apply(stateChild, cn, allLayer);
                }
            }
        }
        var old = serializeCheckState(true);
        try {
            apply(buildStateTree(state), renderer.StateTreeRoot);
            normalizeCheckState();
        }
        catch (e) {
            apply(buildStateTree(old), renderer.StateTreeRoot);
            normalizeCheckState();
            throw e;
        }
    }
    function buildPFV(json) {
        if (json.length !== 1) {
            throw new Error('sorry but favorite tree data is broken');
        }
        var path = [], lines = ['[PSDToolFavorites-v1]'];
        function r(children) {
            for (var i = 0, item = void 0; i < children.length; ++i) {
                item = children[i];
                path.push(encodeLayerName(item.text));
                switch (item.type) {
                    case 'root':
                        lines.push('root-name/' + path[0]);
                        lines.push('');
                        path.pop();
                        r(item.children);
                        path.push('');
                        break;
                    case 'folder':
                        if (item.children.length) {
                            r(item.children);
                        }
                        else {
                            lines.push('//' + path.join('/') + '~folder');
                            lines.push('');
                        }
                        break;
                    case 'filter':
                        lines.push('//' + path.join('/') + '~filter');
                        lines.push(item.data.value);
                        lines.push('');
                        r(item.children);
                        break;
                    case 'item':
                        lines.push('//' + path.join('/'));
                        lines.push(item.data.value);
                        lines.push('');
                        break;
                }
                path.pop();
            }
        }
        r(json);
        return lines.join('\n');
    }
    function countPFVEntries(pfv) {
        var lines = pfv.replace(/\r/g, '').split('\n'), c = 0;
        for (var i = 1; i < lines.length; ++i) {
            if (lines[i].length > 2 && lines[i].substring(0, 2) === '//') {
                ++c;
            }
        }
        return c;
    }
    // https://gist.github.com/boushley/5471599
    function arrayBufferToString(ab) {
        var data = new Uint8Array(ab);
        // If we have a BOM skip it
        var s = '', i = 0, c = 0, c2 = 0, c3 = 0;
        if (data.length >= 3 && data[0] === 0xef && data[1] === 0xbb && data[2] === 0xbf) {
            i = 3;
        }
        while (i < data.length) {
            c = data[i];
            if (c < 128) {
                s += String.fromCharCode(c);
                i++;
            }
            else if (c > 191 && c < 224) {
                if (i + 1 >= data.length) {
                    throw 'UTF-8 Decode failed. Two byte character was truncated.';
                }
                c2 = data[i + 1];
                s += String.fromCharCode(((c & 31) << 6) | (c2 & 63));
                i += 2;
            }
            else {
                if (i + 2 >= data.length) {
                    throw 'UTF-8 Decode failed. Multi byte character was truncated.';
                }
                c2 = data[i + 1];
                c3 = data[i + 2];
                s += String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
                i += 3;
            }
        }
        return s;
    }
    function loadPFVFromDroppedFile() {
        var deferred = m.deferred();
        setTimeout(function () {
            if (!droppedPFV) {
                deferred.resolve(false);
                return;
            }
            loadAsArrayBuffer(function () { return undefined; }, droppedPFV).then(function (buffer) {
                loadPFV(arrayBufferToString(buffer.buffer));
                deferred.resolve(true);
            }).then(deferred.resolve.bind(deferred), deferred.reject.bind(deferred));
        }, 0);
        return deferred.promise;
    }
    function loadPFVFromString(s) {
        var deferred = m.deferred();
        setTimeout(function () {
            if (!s) {
                deferred.resolve(false);
                return;
            }
            try {
                loadPFV(s);
                deferred.resolve(true);
            }
            catch (e) {
                deferred.reject(e);
            }
        }, 0);
        return deferred.promise;
    }
    function loadPFVFromLocalStorage(hash) {
        var deferred = m.deferred();
        var pfv = [];
        if ('psdtool_pfv' in localStorage) {
            pfv = JSON.parse(localStorage['psdtool_pfv']);
        }
        for (var i = pfv.length - 1; i >= 0; --i) {
            if (pfv[i].hash === hash) {
                loadPFVFromString(pfv[i].data).then(function () {
                    uniqueId = pfv[i].id;
                    deferred.resolve(true);
                }, function (e) {
                    deferred.reject(e);
                });
                return deferred.promise;
            }
        }
        setTimeout(function () {
            deferred.resolve(false);
        }, 0);
        return deferred.promise;
    }
    function loadPFV(s) {
        var lines = s.replace(/\r/g, '').split('\n');
        if (lines[0] !== '[PSDToolFavorites-v1]') {
            throw new Error('given PFV file does not have a valid header');
        }
        function addNode(json, name, type, data) {
            var i, j, c, partName, nameParts = name.split('/');
            for (i = 0, c = json; i < nameParts.length; ++i) {
                partName = decodeLayerName(nameParts[i]);
                for (j = 0; j < c.length; ++j) {
                    if (c[j].text === partName) {
                        c = c[j].children;
                        j = -1;
                        break;
                    }
                }
                if (j !== c.length) {
                    continue;
                }
                c.push({
                    text: partName,
                    children: []
                });
                if (i !== nameParts.length - 1) {
                    c[j].type = 'folder';
                    c[j].state = {
                        opened: true
                    };
                    c = c[j].children;
                    continue;
                }
                switch (type) {
                    case 'item':
                        c[j].type = 'item';
                        c[j].data = {
                            value: data
                        };
                        return;
                    case 'folder':
                        c[j].type = 'folder';
                        c[j].state = {
                            opened: true
                        };
                        return;
                    case 'filter':
                        c[j].type = 'item';
                        c[j].data = {
                            value: data
                        };
                        c[j].state = {
                            opened: true
                        };
                        return;
                    default:
                        throw new Error('unknown node type: ' + type);
                }
            }
        }
        var json = [{
                id: 'root',
                text: ui.FavoriteTreeDefaultRootName,
                type: 'root',
                state: {
                    opened: true
                },
                children: []
            }];
        var setting = {
            'root-name': ui.FavoriteTreeDefaultRootName
        };
        var name, type, data = [], first = true, value;
        for (var i = 1; i < lines.length; ++i) {
            if (lines[i] === '') {
                continue;
            }
            if (lines[i].length > 2 && lines[i].substring(0, 2) === '//') {
                if (first) {
                    json[0].text = setting['root-name'];
                    first = false;
                }
                else {
                    addNode(json, encodeLayerName(setting['root-name']) + '/' + name, type, data.join('\n'));
                }
                name = lines[i].substring(2);
                if (name.indexOf('~') !== -1) {
                    data = name.split('~');
                    name = data[0];
                    type = data[1];
                }
                else {
                    type = 'item';
                }
                data = [];
                continue;
            }
            if (first) {
                name = lines[i].substring(0, lines[i].indexOf('/'));
                value = decodeLayerName(lines[i].substring(name.length + 1));
                if (value) {
                    setting[name] = value;
                }
            }
            else {
                data.push(lines[i]);
            }
        }
        if (first) {
            json[0].text = setting['root-name'];
        }
        else {
            addNode(json, encodeLayerName(setting['root-name']) + '/' + name, type, data.join('\n'));
        }
        initFavoriteTree(json);
    }
    document.addEventListener('DOMContentLoaded', init, false);
})();
