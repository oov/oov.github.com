/// <reference path="../typings/browser.d.ts" />
'use strict';
var psdtool;
(function (psdtool) {
    var ProgressDialog = (function () {
        function ProgressDialog(title, text) {
            this.bar = document.getElementById('progress-dialog-progress-bar');
            this.text = document.createTextNode('');
            var label = document.getElementById('progress-dialog-label');
            label.innerHTML = '';
            label.appendChild(document.createTextNode(title));
            var caption = document.getElementById('progress-dialog-progress-caption');
            caption.innerHTML = '';
            caption.appendChild(this.text);
            this.update(0, text);
            this.dialog = jQuery('#progress-dialog');
            if (!this.dialog.data('bs.modal')) {
                this.dialog.modal();
            }
            else {
                this.dialog.modal('show');
            }
        }
        ProgressDialog.prototype.close = function () {
            this.dialog.modal('hide');
        };
        ProgressDialog.prototype.update = function (progress, text) {
            var p = Math.min(100, Math.max(0, progress * 100));
            this.bar.style.width = p + '%';
            this.bar.setAttribute('aria-valuenow', p.toFixed(0) + '%');
            this.text.data = p.toFixed(0) + '% ' + text;
        };
        return ProgressDialog;
    }());
    var FilterDialog = (function () {
        function FilterDialog(favorite) {
            this.favorite = favorite;
        }
        FilterDialog.prototype.init = function () {
            var _this = this;
            {
                var filterTree = document.getElementById('filter-tree');
                if (filterTree instanceof HTMLUListElement) {
                    this.treeRoot = filterTree;
                }
                else {
                    throw new Error('#filter-tree is not an UL element');
                }
            }
            this.treeRoot.innerHTML = '';
            this.treeRoot.addEventListener('click', function (e) {
                var inp = e.target;
                if (inp instanceof HTMLInputElement) {
                    var li = inp.parentElement;
                    while (!(li instanceof HTMLLIElement)) {
                        li = li.parentElement;
                    }
                    var checked = inp.checked;
                    var inputs = li.querySelectorAll('input');
                    for (var i = 0; i < inputs.length; ++i) {
                        var inp_1 = inputs[i];
                        if (inp_1 instanceof HTMLInputElement) {
                            inp_1.checked = checked;
                        }
                    }
                    if (checked) {
                        for (var parent_1 = li.parentElement; parent_1 !== _this.treeRoot; parent_1 = parent_1.parentElement) {
                            if (parent_1 instanceof HTMLLIElement) {
                                var inp_2 = parent_1.querySelector('input');
                                if (inp_2 instanceof HTMLInputElement) {
                                    inp_2.checked = true;
                                }
                            }
                        }
                    }
                    _this.updateClass();
                    _this.update();
                }
            }, false);
            {
                var useFilter = document.getElementById('use-filter');
                if (useFilter instanceof HTMLInputElement) {
                    this.useFilter = useFilter;
                }
                else {
                    throw new Error('#filter-tree is not an INPUT element');
                }
            }
            this.useFilter.addEventListener('click', function (e) {
                _this.updateClass();
                _this.update();
            }, false);
            {
                var dialog = document.getElementById('filter-dialog');
                if (dialog instanceof HTMLDivElement) {
                    this.dialog = dialog;
                }
                else {
                    throw new Error('#filter-dialog is not an DIV element');
                }
            }
            jQuery(this.dialog).on('shown.bs.modal', function (e) {
                var filters = _this.favorite.getAncestorFilters(_this.node);
                if (_this.node.type === 'filter') {
                    _this.useFilter.checked = true;
                    _this.root.deserialize(_this.node.data.value, filters);
                }
                else {
                    _this.useFilter.checked = false;
                    _this.root.deserialize('', filters);
                }
                _this.updateClass();
            });
        };
        FilterDialog.prototype.load = function (psd) {
            if (!this.treeRoot) {
                this.init();
            }
            this.root = new LayerTree.Filter(this.treeRoot, psd);
        };
        FilterDialog.prototype.updateClass = function () {
            if (this.useFilter.checked) {
                this.treeRoot.classList.remove('disabled');
            }
            else {
                this.treeRoot.classList.add('disabled');
            }
            var inputs = this.treeRoot.querySelectorAll('input');
            for (var i = 0, elem = void 0, li = void 0; i < inputs.length; ++i) {
                elem = inputs[i];
                if (elem instanceof HTMLInputElement) {
                    li = elem.parentElement;
                    while (li && li.tagName !== 'LI') {
                        li = li.parentElement;
                    }
                    if (elem.disabled) {
                        li.classList.add('disabled');
                    }
                    else {
                        li.classList.remove('disabled');
                    }
                    if (elem.checked) {
                        li.classList.add('checked');
                    }
                    else {
                        li.classList.remove('checked');
                    }
                }
            }
        };
        FilterDialog.prototype.update = function () {
            if (this.useFilter.checked) {
                var s = this.root.serialize();
                if (s) {
                    if (this.onUpdate) {
                        this.onUpdate(this.node.id, 'filter', s);
                    }
                    return;
                }
            }
            if (this.onUpdate) {
                this.onUpdate(this.node.id, 'folder', null);
            }
        };
        FilterDialog.prototype.show = function (n) {
            this.node = n;
            var dialog = jQuery(this.dialog);
            if (!dialog.data('bs.modal')) {
                dialog.modal();
            }
            else {
                dialog.modal('show');
            }
        };
        return FilterDialog;
    }());
    var FaviewSettingDialog = (function () {
        function FaviewSettingDialog(favorite) {
            var _this = this;
            this.favorite = favorite;
            {
                var faviewMode = document.getElementById('faview-mode');
                if (faviewMode instanceof HTMLSelectElement) {
                    this.faviewMode = faviewMode;
                }
                else {
                    throw new Error('#faview-mode is not a SELECT element');
                }
            }
            this.faviewMode.addEventListener('change', function (e) { return _this.update(); });
            {
                var dialog = document.getElementById('faview-setting-dialog');
                if (dialog instanceof HTMLDivElement) {
                    this.dialog = dialog;
                }
                else {
                    throw new Error('#faview-setting-dialog is not an DIV element');
                }
            }
            jQuery(this.dialog).on('shown.bs.modal', function (e) {
                _this.faviewMode.selectedIndex = _this.favorite.faviewMode;
            });
        }
        FaviewSettingDialog.prototype.update = function () {
            this.favorite.faviewMode = this.faviewMode.selectedIndex;
            if (this.onUpdate) {
                this.onUpdate();
            }
        };
        return FaviewSettingDialog;
    }());
    var Main = (function () {
        function Main() {
            this.sideBodyScrollPos = {};
        }
        Main.prototype.init = function () {
            var _this = this;
            Main.initDropZone('dropzone', function (files) {
                var i, ext;
                for (i = 0; i < files.length; ++i) {
                    ext = files[i].name.substring(files[i].name.length - 4).toLowerCase();
                    if (ext === '.pfv') {
                        _this.droppedPFV = files[i];
                        break;
                    }
                }
                for (i = 0; i < files.length; ++i) {
                    ext = files[i].name.substring(files[i].name.length - 4).toLowerCase();
                    if (ext !== '.pfv') {
                        _this.loadAndParse(files[i]);
                        return;
                    }
                }
            });
            this.initUI();
            document.getElementById('samplefile').addEventListener('click', function (e) {
                return _this.loadAndParse(document.getElementById('samplefile').getAttribute('data-filename'));
            }, false);
            window.addEventListener('resize', function (e) { return _this.resized(); }, false);
            window.addEventListener('hashchange', function (e) { return _this.hashchanged(); }, false);
            this.hashchanged();
            var elems = document.querySelectorAll('.psdtool-loading');
            for (var i = 0; i < elems.length; ++i) {
                elems[i].classList.add('psdtool-loaded');
                elems[i].classList.remove('psdtool-loading');
            }
        };
        Main.prototype.hashchanged = function () {
            var hashData = decodeURIComponent(location.hash.substring(1));
            if (hashData.substring(0, 5) === 'load:') {
                this.loadAndParse(hashData.substring(5));
            }
        };
        Main.prototype.resized = function () {
            var mainContainer = document.getElementById('main-container');
            var miscUi = document.getElementById('misc-ui');
            var previewContainer = document.getElementById('preview-container');
            var old = previewContainer.style.display;
            previewContainer.style.display = 'none';
            previewContainer.style.width = mainContainer.clientWidth + 'px';
            previewContainer.style.height = (mainContainer.clientHeight - miscUi.offsetHeight) + 'px';
            previewContainer.style.display = old;
            var sideContainer = document.getElementById('side-container');
            var sideHead = document.getElementById('side-head');
            var sideBody = document.getElementById('side-body');
            old = sideBody.style.display;
            sideBody.style.display = 'none';
            sideBody.style.width = sideContainer.clientWidth + 'px';
            sideBody.style.height = (sideContainer.clientHeight - sideHead.offsetHeight) + 'px';
            sideBody.style.display = old;
            var toolbars = document.querySelectorAll('.psdtool-tab-toolbar');
            for (var i = 0; i < toolbars.length; ++i) {
                var elem = toolbars[i];
                if (elem instanceof HTMLElement) {
                    var p = elem.parentElement;
                    while (!p.classList.contains('psdtool-tab-pane') && p) {
                        p = p.parentElement;
                    }
                    if (p) {
                        p.style.paddingTop = elem.clientHeight + 'px';
                    }
                }
            }
        };
        Main.prototype.loadAndParse = function (input) {
            var _this = this;
            var fileOpenUi = document.getElementById('file-open-ui');
            var errorReportUi = document.getElementById('error-report-ui');
            var main = document.getElementById('main');
            fileOpenUi.style.display = 'block';
            errorReportUi.style.display = 'none';
            main.style.display = 'none';
            Mousetrap.pause();
            var errorMessageContainer = document.getElementById('error-message');
            var errorMessage = document.createTextNode('');
            errorMessageContainer.innerHTML = '';
            errorMessageContainer.appendChild(errorMessage);
            var prog = new ProgressDialog('Loading...', 'Getting ready...');
            Main.loadAsBlob(function (p) { return prog.update(p, 'Receiving file...'); }, input)
                .then(function (o) {
                return _this.parse(function (p) { return prog.update(p, 'Loading file...'); }, o);
            })
                .then(function () {
                prog.close();
                fileOpenUi.style.display = 'none';
                errorReportUi.style.display = 'none';
                main.style.display = 'block';
                Mousetrap.unpause();
                _this.resized();
            }, function (e) {
                prog.close();
                fileOpenUi.style.display = 'block';
                errorReportUi.style.display = 'block';
                main.style.display = 'none';
                Mousetrap.pause();
                errorMessage.data = e.toString();
                console.error(e);
            });
        };
        Main.prototype.parse = function (progress, obj) {
            var _this = this;
            var deferred = m.deferred();
            PSD.parseWorker(obj.buffer, progress, function (psd) {
                try {
                    _this.psdRoot = psd;
                    _this.loadLayerTree(psd);
                    _this.filterDialog.load(psd);
                    _this.loadRenderer(psd);
                    _this.maxPixels.value = (_this.optionAutoTrim.checked ? _this.renderer.Height : _this.renderer.CanvasHeight).toString();
                    _this.seqDlPrefix.value = obj.name;
                    _this.seqDlNum.value = '0';
                    var readmeButtons = document.querySelectorAll('.psdtool-show-readme');
                    for (var i = 0, elem = void 0; i < readmeButtons.length; ++i) {
                        elem = readmeButtons[i];
                        if (elem instanceof HTMLElement) {
                            if (psd.Readme !== '') {
                                elem.classList.remove('hidden');
                            }
                            else {
                                elem.classList.add('hidden');
                            }
                        }
                    }
                    document.getElementById('readme').textContent = psd.Readme;
                    //  TODO: error handling
                    _this.favorite.psdHash = psd.Hash;
                    if (_this.droppedPFV) {
                        var fr_1 = new FileReader();
                        fr_1.onload = function () {
                            _this.favorite.loadFromArrayBuffer(fr_1.result);
                        };
                        fr_1.readAsArrayBuffer(_this.droppedPFV);
                    }
                    else {
                        var pfvData = _this.favorite.getPFVFromLocalStorage(psd.Hash);
                        if (pfvData && pfvData.time / 1000 > psd.PFVModDate) {
                            _this.favorite.loadFromString(pfvData.data, pfvData.id);
                        }
                        else if (psd.PFV) {
                            _this.favorite.loadFromString(psd.PFV);
                        }
                    }
                    _this.redraw();
                    deferred.resolve(true);
                }
                catch (e) {
                    deferred.reject(e);
                }
            }, function (error) { return deferred.reject(error); });
            return deferred.promise;
        };
        Main.prototype.pfvOnDrop = function (files) {
            var _this = this;
            this.leaveReaderMode();
            var i, ext;
            var _loop_1 = function() {
                ext = files[i].name.substring(files[i].name.length - 4).toLowerCase();
                if (ext === '.pfv') {
                    // TODO: error handling
                    var fr_2 = new FileReader();
                    fr_2.onload = function (e) {
                        if (_this.favorite.loadFromArrayBuffer(fr_2.result)) {
                            jQuery('#import-dialog').modal('hide');
                        }
                    };
                    fr_2.readAsArrayBuffer(files[i]);
                    return { value: void 0 };
                }
            };
            for (i = 0; i < files.length; ++i) {
                var state_1 = _loop_1();
                if (typeof state_1 === "object") return state_1.value;
            }
        };
        Main.prototype.initFavoriteUI = function () {
            var _this = this;
            this.favorite = new Favorite.Favorite(document.getElementById('favorite-tree'), document.getElementById('favorite-tree').getAttribute('data-root-name'));
            this.favorite.onModified = function () {
                _this.needRefreshFaview = true;
            };
            this.favorite.onLoaded = function () {
                _this.startFaview();
                switch (_this.favorite.faviewMode) {
                    case 0 /* ShowLayerTree */:
                        _this.toogleTreeFaview(false);
                        break;
                    case 1 /* ShowFaview */:
                        if (!_this.faview.closed) {
                            _this.toogleTreeFaview(true);
                        }
                        break;
                    case 2 /* ShowFaviewAndReadme */:
                        if (!_this.faview.closed) {
                            _this.toogleTreeFaview(true);
                            if (_this.psdRoot.Readme !== '') {
                                jQuery('#readme-dialog').modal('show');
                            }
                        }
                        break;
                }
            };
            this.favorite.onClearSelection = function () { return _this.leaveReaderMode(); };
            this.favorite.onSelect = function (item) {
                if (item.type !== 'item') {
                    _this.leaveReaderMode();
                    return;
                }
                try {
                    _this.enterReaderMode(item.data.value, _this.favorite.getFirstFilter(item), item.text + '.png');
                }
                catch (e) {
                    console.error(e);
                    alert(e);
                }
            };
            this.favorite.onDoubleClick = function (item) {
                try {
                    switch (item.type) {
                        case 'item':
                            _this.leaveReaderMode(item.data.value, _this.favorite.getFirstFilter(item));
                            break;
                        case 'folder':
                        case 'filter':
                            _this.filterDialog.show(item);
                            break;
                    }
                }
                catch (e) {
                    console.error(e);
                    alert(e);
                }
            };
            this.filterDialog = new FilterDialog(this.favorite);
            this.filterDialog.onUpdate = function (id, type, data) {
                _this.favorite.update({ id: id, type: type, data: { value: data } });
                _this.favorite.updateLocalStorage();
                _this.needRefreshFaview = true;
            };
            jQuery('button[data-psdtool-tree-add-item]').on('click', function (e) {
                _this.leaveReaderMode();
                _this.favorite.add('item', true, '', _this.layerRoot.serialize(false));
            });
            Mousetrap.bind('mod+b', function (e) {
                e.preventDefault();
                var text = prompt(document.querySelector('button[data-psdtool-tree-add-item]').getAttribute('data-caption'), 'New Item');
                if (text === null) {
                    return;
                }
                _this.leaveReaderMode();
                _this.favorite.add('item', false, text, _this.layerRoot.serialize(false));
            });
            jQuery('button[data-psdtool-tree-add-folder]').on('click', function (e) {
                _this.favorite.add('folder', true);
            });
            Mousetrap.bind('mod+d', function (e) {
                e.preventDefault();
                var text = prompt(document.querySelector('button[data-psdtool-tree-add-folder]').getAttribute('data-caption'), 'New Folder');
                if (text === null) {
                    return;
                }
                _this.favorite.clearSelection();
                _this.favorite.add('folder', false, text);
            });
            jQuery('button[data-psdtool-tree-rename]').on('click', function (e) { return _this.favorite.edit(); });
            Mousetrap.bind('f2', function (e) {
                e.preventDefault();
                _this.favorite.edit();
            });
            jQuery('button[data-psdtool-tree-remove]').on('click', function (e) { return _this.favorite.remove(); });
            Mousetrap.bind('shift+mod+g', function (e) {
                var target = e.target;
                if (target instanceof HTMLElement && target.classList.contains('psdtool-layer-visible')) {
                    e.preventDefault();
                    if (!target.classList.contains('psdtool-layer-radio')) {
                        return;
                    }
                    if (target instanceof HTMLInputElement) {
                        var old = _this.layerRoot.serialize(true);
                        var created = [];
                        var n = void 0;
                        var elems = document.querySelectorAll('input[name="' + target.name + '"].psdtool-layer-radio');
                        for (var i = 0; i < elems.length; ++i) {
                            n = _this.layerRoot.nodes[parseInt(elems[i].getAttribute('data-seq'), 10)];
                            if (n.li.classList.contains('psdtool-item-flip-x') ||
                                n.li.classList.contains('psdtool-item-flip-y') ||
                                n.li.classList.contains('psdtool-item-flip-xy')) {
                                continue;
                            }
                            n.checked = true;
                            _this.favorite.add('item', false, n.displayName, _this.layerRoot.serialize(false));
                            created.push(n.displayName);
                        }
                        _this.layerRoot.deserialize(old);
                        _this.redraw();
                        alert(created.length + ' favorite item(s) has been added.\n\n' + created.join('\n'));
                    }
                }
            });
            Main.initDropZone('pfv-dropzone', function (files) { return _this.pfvOnDrop(files); });
            Main.initDropZone('pfv-dropzone2', function (files) { return _this.pfvOnDrop(files); });
            jQuery('#import-dialog').on('shown.bs.modal', function (e) {
                // build the recent list
                var recents = document.getElementById('pfv-recents');
                recents.innerHTML = '';
                var btn;
                var pfvs = _this.favorite.getPFVListFromLocalStorage();
                for (var i = pfvs.length - 1; i >= 0; --i) {
                    btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'list-group-item';
                    if (pfvs[i].hash === _this.psdRoot.Hash) {
                        btn.className += ' list-group-item-info';
                    }
                    btn.setAttribute('data-dismiss', 'modal');
                    (function (btn, data, uniqueId) {
                        btn.addEventListener('click', function (e) {
                            _this.leaveReaderMode();
                            // TODO: error handling
                            _this.favorite.loadFromString(data, uniqueId);
                        }, false);
                    })(btn, pfvs[i].data, pfvs[i].id);
                    btn.appendChild(document.createTextNode(Favorite.countEntries(pfvs[i].data) +
                        ' item(s) / Created at ' +
                        Main.formateDate(new Date(pfvs[i].time))));
                    recents.appendChild(btn);
                }
            });
            jQuery('#bulk-create-folder-dialog').on('shown.bs.modal', function (e) { return _this.bulkCreateFolderTextarea.focus(); });
            var e = document.getElementById('bulk-create-folder-textarea');
            if (e instanceof HTMLTextAreaElement) {
                this.bulkCreateFolderTextarea = e;
            }
            else {
                throw new Error('element not found: #bulk-create-folder-textarea');
            }
            document.getElementById('bulk-create-folder').addEventListener('click', function (e) {
                var folders = [];
                for (var _i = 0, _a = _this.bulkCreateFolderTextarea.value.replace(/\r/g, '').split('\n'); _i < _a.length; _i++) {
                    var line = _a[_i];
                    line = line.trim();
                    if (line === '') {
                        continue;
                    }
                    folders.push(line);
                }
                _this.favorite.addFolders(folders);
                _this.bulkCreateFolderTextarea.value = '';
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
                _this.bulkRenameData = _this.favorite.renameNodes;
                elem.innerHTML = '';
                r(elem, _this.bulkRenameData);
            });
            document.getElementById('bulk-rename').addEventListener('click', function (e) {
                // auto numbering
                var digits = 1;
                {
                    var elem = document.getElementById('rename-digits');
                    if (elem instanceof HTMLSelectElement) {
                        digits = parseInt(elem.value, 10);
                    }
                }
                var n = 0;
                {
                    var elem = document.getElementById('rename-start-number');
                    if (elem instanceof HTMLInputElement) {
                        n = parseInt(elem.value, 10);
                    }
                }
                var elems = document.getElementById('bulk-rename-tree').querySelectorAll('input');
                for (var i = 0; i < elems.length; ++i) {
                    var elem = elems[i];
                    if (elem instanceof HTMLInputElement && elem.value === '') {
                        elem.value = ('0000' + n.toString()).slice(-digits);
                        elem.onblur(null);
                        ++n;
                    }
                }
                _this.favorite.bulkRename(_this.bulkRenameData);
            }, false);
            document.getElementById('export-favorites-pfv').addEventListener('click', function (e) {
                saveAs(new Blob([_this.favorite.pfv], {
                    type: 'text/plain'
                }), Main.cleanForFilename(_this.favorite.rootName) + '.pfv');
            }, false);
            document.getElementById('export-favorites-zip').addEventListener('click', function (e) {
                _this.exportZIP(false);
            }, false);
            document.getElementById('export-favorites-zip-filter-solo').addEventListener('click', function (e) {
                _this.exportZIP(true);
            }, false);
            document.getElementById('export-layer-structure').addEventListener('click', function (e) {
                saveAs(new Blob([_this.layerRoot.text], {
                    type: 'text/plain'
                }), 'layer.txt');
            }, false);
            var faviewToggleButtons = document.querySelectorAll('.psdtool-toggle-tree-faview');
            for (var i = 0; i < faviewToggleButtons.length; ++i) {
                faviewToggleButtons[i].addEventListener('click', function (e) { return _this.toogleTreeFaview(); }, false);
            }
            this.faviewSettingDialog = new FaviewSettingDialog(this.favorite);
            this.faviewSettingDialog.onUpdate = function () { return _this.favorite.updateLocalStorage(); };
        };
        Main.prototype.toogleTreeFaview = function (forceActiveFaview) {
            var pane = document.getElementById('layer-tree-pane');
            if (forceActiveFaview === undefined) {
                forceActiveFaview = !pane.classList.contains('faview-active');
            }
            if (forceActiveFaview) {
                pane.classList.add('faview-active');
                this.faviewOnRootChanged();
            }
            else {
                pane.classList.remove('faview-active');
            }
        };
        Main.prototype.startFaview = function () {
            var _this = this;
            this.resized();
            if (!this.faview) {
                var rootSel = void 0;
                var root = void 0;
                var elem = document.getElementById('faview-root-node');
                if (elem instanceof HTMLSelectElement) {
                    rootSel = elem;
                }
                else {
                    throw new Error('element not found: #faview-root-node');
                }
                elem = document.getElementById('faview-tree');
                if (elem instanceof HTMLUListElement) {
                    root = elem;
                }
                else {
                    throw new Error('element not found: #faview-tree');
                }
                this.faview = new Favorite.Faview(this.favorite, rootSel, root);
                this.faview.onRootChanged = function () { return _this.faviewOnRootChanged(); };
                this.faview.onChange = function (node) { return _this.faviewOnChange(node); };
            }
            document.getElementById('layer-tree-toolbar').classList.remove('hidden');
            this.faview.start();
            this.needRefreshFaview = false;
            if (this.faview.roots === 0) {
                this.endFaview();
            }
            else {
                this.resized();
            }
        };
        Main.prototype.refreshFaview = function () {
            if (!this.needRefreshFaview) {
                return;
            }
            this.faview.refresh();
            this.needRefreshFaview = false;
            if (this.faview.roots === 0) {
                this.endFaview();
            }
        };
        Main.prototype.faviewOnRootChanged = function () {
            this.leaveReaderMode();
            for (var _i = 0, _a = this.faview.getActive(); _i < _a.length; _i++) {
                var n = _a[_i];
                this.layerRoot.deserializePartial(undefined, n.data.value, this.favorite.getFirstFilter(n));
            }
            this.redraw();
        };
        Main.prototype.faviewOnChange = function (node) {
            this.leaveReaderMode(node.data.value, this.favorite.getFirstFilter(node));
        };
        Main.prototype.endFaview = function () {
            document.getElementById('layer-tree-toolbar').classList.add('hidden');
            this.toogleTreeFaview(false);
            this.resized();
            this.faview.close();
        };
        Main.prototype.exportZIP = function (filterSolo) {
            var _this = this;
            var parents = [];
            var path = [], files = [];
            var r = function (children) {
                for (var _i = 0, children_1 = children; _i < children_1.length; _i++) {
                    var item = children_1[_i];
                    path.push(Main.cleanForFilename(item.text.replace(/^\*/, '')));
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
            var json = this.favorite.json;
            r(json);
            var backup = this.layerRoot.serialize(true);
            var z = new Zipper.Zipper();
            var prog = new ProgressDialog('Exporting...', '');
            var aborted = false;
            var errorHandler = function (readableMessage, err) {
                z.dispose(function (err) { return undefined; });
                console.error(err);
                if (!aborted) {
                    alert(readableMessage + ': ' + err);
                }
                prog.close();
            };
            // it is needed to avoid alert storm when reload during exporting.
            window.addEventListener('unload', function () { aborted = true; }, false);
            var added = 0;
            var addedHandler = function () {
                if (++added < files.length + 1) {
                    prog.update(added / (files.length + 1), added === 1 ? 'drawing...' : '(' + added + '/' + files.length + ') ' + files[added - 1].name);
                    return;
                }
                _this.layerRoot.deserialize(backup);
                prog.update(1, 'building a zip...');
                z.generate(function (blob) {
                    prog.close();
                    saveAs(blob, Main.cleanForFilename(_this.favorite.rootName) + '.zip');
                    z.dispose(function (err) { return undefined; });
                }, function (e) { return errorHandler('cannot create a zip archive', e); });
            };
            z.init(function () {
                z.add('favorites.pfv', new Blob([_this.favorite.pfv], { type: 'text/plain; charset=utf-8' }), addedHandler, function (e) { return errorHandler('cannot write pfv to a zip archive', e); });
                var i = 0;
                var process = function () {
                    if ('filter' in files[i]) {
                        _this.layerRoot.deserializePartial(filterSolo ? '' : backup, files[i].value, files[i].filter);
                    }
                    else {
                        _this.layerRoot.deserialize(files[i].value);
                    }
                    _this.render(function (progress, canvas) {
                        if (progress !== 1) {
                            return;
                        }
                        z.add(files[i].name, new Blob([Main.dataSchemeURIToArrayBuffer(canvas.toDataURL())], { type: 'image/png' }), addedHandler, function (e) { return errorHandler('cannot write png to a zip archive', e); });
                        if (++i < files.length) {
                            setTimeout(process, 0);
                        }
                    });
                };
                process();
            }, function (e) { return errorHandler('cannot create a zip archive', e); });
        };
        Main.prototype.initUI = function () {
            var _this = this;
            this.optionAutoTrim = Main.getInputElement('#option-auto-trim');
            this.optionSafeMode = Main.getInputElement('#option-safe-mode');
            // save and restore scroll position of side-body on each tab.
            var toolbars = document.querySelectorAll('.psdtool-tab-toolbar');
            this.sideBody = document.getElementById('side-body');
            this.sideBody.addEventListener('scroll', function (e) {
                var pos = _this.sideBody.scrollTop + 'px';
                for (var i = 0; i < toolbars.length; ++i) {
                    var elem_1 = toolbars[i];
                    if (elem_1 instanceof HTMLElement) {
                        elem_1.style.top = pos;
                    }
                }
            }, false);
            this.sideBodyScrollPos = {};
            jQuery('a[data-toggle="tab"]').on('hide.bs.tab', function (e) {
                var tab = e.target.getAttribute('href');
                _this.sideBodyScrollPos[tab] = {
                    left: _this.sideBody.scrollLeft,
                    top: _this.sideBody.scrollTop
                };
            }).on('shown.bs.tab', function (e) {
                var tab = e.target.getAttribute('href');
                if (tab in _this.sideBodyScrollPos) {
                    _this.sideBody.scrollLeft = _this.sideBodyScrollPos[tab].left;
                    _this.sideBody.scrollTop = _this.sideBodyScrollPos[tab].top;
                }
                _this.resized();
            });
            jQuery('a[data-toggle="tab"][href="#layer-tree-pane"]').on('show.bs.tab', function (e) {
                _this.leaveReaderMode();
                if (!_this.faview || _this.faview.closed) {
                    _this.startFaview();
                }
                _this.refreshFaview();
            });
            this.initFavoriteUI();
            this.previewBackground = document.getElementById('preview-background');
            var elem = document.getElementById('preview');
            if (elem instanceof HTMLCanvasElement) {
                this.previewCanvas = elem;
            }
            else {
                throw new Error('element not found: #preview');
            }
            this.previewCanvas.addEventListener('dragstart', function (e) {
                var s = _this.previewCanvas.toDataURL();
                var name = _this.previewCanvas.getAttribute('data-filename');
                if (name) {
                    var p = s.indexOf(';');
                    s = s.substring(0, p) + ';filename=' + encodeURIComponent(name) + s.substring(p);
                }
                e.dataTransfer.setData('text/uri-list', s);
                e.dataTransfer.setData('text/plain', s);
            }, false);
            jQuery('#main').on('splitpaneresize', function (e) { return _this.resized(); }).splitPane();
            elem = document.getElementById('flip');
            if (elem instanceof HTMLSelectElement) {
                this.flip = elem;
            }
            this.flip.addEventListener('change', function (e) { return _this.redraw(); }, false);
            this.flip.addEventListener('keyup', function (e) { _this.flip.blur(); _this.flip.focus(); }, false);
            elem = document.getElementById('fixed-side');
            if (elem instanceof HTMLSelectElement) {
                this.fixedSide = elem;
            }
            else {
                throw new Error('element not found: #fixed-side');
            }
            this.fixedSide.addEventListener('change', function (e) { return _this.redraw(); }, false);
            var lastPx;
            this.maxPixels = Main.getInputElement('#max-pixels');
            this.maxPixels.addEventListener('blur', function (e) {
                var v = Main.normalizeNumber(_this.maxPixels.value);
                if (v === lastPx) {
                    return;
                }
                lastPx = v;
                _this.maxPixels.value = v;
                _this.redraw();
            }, false);
            this.seqDlPrefix = Main.getInputElement('#seq-dl-prefix');
            this.seqDlNum = Main.getInputElement('#seq-dl-num');
            elem = document.getElementById('seq-dl');
            if (elem instanceof HTMLButtonElement) {
                this.seqDl = elem;
            }
            else {
                throw new Error('element not found: #seq-dl');
            }
            this.seqDl.addEventListener('click', function (e) {
                var prefix = _this.seqDlPrefix.value;
                if (_this.seqDlNum.value === '') {
                    _this.save(prefix + '.png');
                    return;
                }
                var num = parseInt(Main.normalizeNumber(_this.seqDlNum.value), 10);
                if (num < 0) {
                    num = 0;
                }
                _this.save(prefix + ('0000' + num).slice(-4) + '.png');
                _this.seqDlNum.value = (num + 1).toString();
            }, false);
            Mousetrap.pause();
        };
        Main.prototype.redraw = function () {
            var _this = this;
            this.seqDl.disabled = true;
            this.render(function (progress, canvas) {
                _this.previewBackground.style.width = canvas.width + 'px';
                _this.previewBackground.style.height = canvas.height + 'px';
                _this.seqDl.disabled = progress !== 1;
                _this.previewCanvas.draggable = progress === 1;
                setTimeout(function () {
                    _this.previewCanvas.width = canvas.width;
                    _this.previewCanvas.height = canvas.height;
                    _this.previewCanvas.getContext('2d').drawImage(canvas, 0, 0);
                }, 0);
            });
            this.layerRoot.updateClass();
        };
        Main.prototype.save = function (filename) {
            saveAs(new Blob([
                Main.dataSchemeURIToArrayBuffer(this.previewCanvas.toDataURL())
            ], { type: 'image/png' }), filename);
        };
        Main.prototype.loadRenderer = function (psd) {
            this.renderer = new Renderer.Renderer(psd);
            var lNodes = this.layerRoot.nodes;
            var rNodes = this.renderer.nodes;
            for (var key in rNodes) {
                if (!rNodes.hasOwnProperty(key)) {
                    continue;
                }
                (function (r, l) {
                    r.getVisibleState = function () { return l.checked; };
                })(rNodes[key], lNodes[key]);
            }
        };
        Main.prototype.render = function (callback) {
            var autoTrim = this.optionAutoTrim.checked;
            var w = autoTrim ? this.renderer.Width : this.renderer.CanvasWidth;
            var h = autoTrim ? this.renderer.Height : this.renderer.CanvasHeight;
            var px = parseInt(this.maxPixels.value, 10);
            var scale = 1;
            switch (this.fixedSide.value) {
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
            var rf;
            var flipType = parseInt(this.flip.value, 10);
            switch (flipType) {
                case 0 /* NoFlip */:
                    rf = 0 /* NoFlip */;
                    break;
                case 1 /* FlipX */:
                    rf = 1 /* FlipX */;
                    break;
                case 2 /* FlipY */:
                    rf = 2 /* FlipY */;
                    break;
                case 3 /* FlipXY */:
                    rf = 3 /* FlipXY */;
                    break;
                default:
                    rf = 0 /* NoFlip */;
                    flipType = 0 /* NoFlip */;
            }
            if (this.layerRoot.flip !== flipType) {
                this.layerRoot.flip = flipType;
            }
            this.renderer.render(scale, autoTrim, rf, callback);
        };
        Main.prototype.initLayerTree = function () {
            var _this = this;
            {
                var layerTree = document.getElementById('layer-tree');
                if (layerTree instanceof HTMLUListElement) {
                    this.layerTree = layerTree;
                }
                else {
                    throw new Error('#layer-tree is not an UL element');
                }
            }
            this.layerTree.innerHTML = '';
            this.layerTree.addEventListener('click', function (e) {
                var target = e.target;
                if (target instanceof HTMLInputElement && target.classList.contains('psdtool-layer-visible')) {
                    var n = _this.layerRoot.nodes[parseInt(target.getAttribute('data-seq'), 10)];
                    for (var p = n.parent; !p.isRoot; p = p.parent) {
                        p.checked = true;
                    }
                    if (n.clippedBy) {
                        n.clippedBy.checked = true;
                    }
                    _this.redraw();
                }
            }, false);
        };
        Main.prototype.loadLayerTree = function (psd) {
            if (!this.layerTree) {
                this.initLayerTree();
            }
            this.layerRoot = new LayerTree.LayerTree(this.optionSafeMode.checked, this.layerTree, psd);
        };
        Main.prototype.enterReaderMode = function (state, filter, filename) {
            if (!this.previewBackground.classList.contains('reader')) {
                this.previewBackground.classList.add('reader');
                this.normalModeState = this.layerRoot.serialize(true);
            }
            if (!filter) {
                this.layerRoot.deserialize(state);
            }
            else {
                this.layerRoot.deserializePartial(this.normalModeState, state, filter);
            }
            if (filename) {
                this.previewCanvas.setAttribute('data-filename', filename);
            }
            this.redraw();
        };
        Main.prototype.leaveReaderMode = function (state, filter) {
            if (this.previewBackground.classList.contains('reader')) {
                this.previewBackground.classList.remove('reader');
            }
            if (state) {
                this.previewCanvas.removeAttribute('data-filename');
                if (!filter) {
                    this.layerRoot.deserialize(state);
                }
                else {
                    if (this.normalModeState) {
                        this.layerRoot.deserializePartial(this.normalModeState, state, filter);
                    }
                    else {
                        this.layerRoot.deserializePartial(undefined, state, filter);
                    }
                }
            }
            else if (this.normalModeState) {
                this.previewCanvas.removeAttribute('data-filename');
                this.layerRoot.deserialize(this.normalModeState);
            }
            else {
                return;
            }
            this.redraw();
            this.normalModeState = null;
        };
        // static --------------------------------
        Main.getInputElement = function (query) {
            var elem = document.querySelector(query);
            if (elem instanceof HTMLInputElement) {
                return elem;
            }
            throw new Error('element not found ' + query);
        };
        Main.cleanForFilename = function (f) {
            return f.replace(/[\x00-\x1f\x22\x2a\x2f\x3a\x3c\x3e\x3f\x7c\x7f]+/g, '_');
        };
        Main.formateDate = function (d) {
            var s = d.getFullYear() + '-';
            s += ('0' + (d.getMonth() + 1)).slice(-2) + '-';
            s += ('0' + d.getDate()).slice(-2) + ' ';
            s += ('0' + d.getHours()).slice(-2) + ':';
            s += ('0' + d.getMinutes()).slice(-2) + ':';
            s += ('0' + d.getSeconds()).slice(-2);
            return s;
        };
        Main.extractFilePrefixFromUrl = function (url) {
            url = url.replace(/#[^#]*$/, '');
            url = url.replace(/\?[^?]*$/, '');
            url = url.replace(/^.*?([^\/]+)$/, '$1');
            url = url.replace(/\..*$/i, '') + '_';
            return url;
        };
        Main.initDropZone = function (dropZoneId, loader) {
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
                var file_1 = f;
                f.addEventListener('change', function (e) {
                    loader(file_1.files);
                    file_1.value = null;
                }, false);
            }
        };
        Main.dataSchemeURIToArrayBuffer = function (str) {
            var bin = atob(str.substring(str.indexOf(',') + 1));
            var buf = new Uint8Array(bin.length);
            for (var i = 0; i < bin.length; ++i) {
                buf[i] = bin.charCodeAt(i);
            }
            return buf.buffer;
        };
        Main.normalizeNumber = function (s) {
            return s.replace(/[\uff10-\uff19]/g, function (m) {
                return (m[0].charCodeAt(0) - 0xff10).toString();
            });
        };
        Main.loadAsBlobCrossDomain = function (progress, url) {
            var deferred = m.deferred();
            if (location.protocol === 'https:' && url.substring(0, 5) === 'http:') {
                setTimeout(function () { return deferred.reject(new Error('cannot access to the insecure content from HTTPS.')); }, 0);
                return deferred.promise;
            }
            var ifr = document.createElement('iframe');
            var port;
            var timer = setTimeout(function () {
                port.onmessage = null;
                document.body.removeChild(ifr);
                deferred.reject(new Error('something went wrong'));
            }, 20000);
            ifr.setAttribute('sandbox', 'allow-scripts allow-same-origin');
            ifr.onload = function (e) {
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
                            progress(1);
                            deferred.resolve({
                                buffer: e.data.data,
                                name: e.data.name ? e.data.name : Main.extractFilePrefixFromUrl(url)
                            });
                            return;
                        case 'error':
                            document.body.removeChild(ifr);
                            deferred.reject(new Error(e.data.message ? e.data.message : 'could not receive data'));
                            return;
                        case 'progress':
                            if (('loaded' in e.data) && ('total' in e.data)) {
                                progress(e.data.loaded / e.data.total);
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
        };
        Main.loadAsBlobFromString = function (progress, url) {
            if (url.substring(0, 3) === 'xd:') {
                return this.loadAsBlobCrossDomain(progress, url.substring(3));
            }
            var deferred = m.deferred();
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url);
            xhr.responseType = 'blob';
            xhr.onload = function (e) {
                progress(1);
                if (xhr.status === 200) {
                    deferred.resolve({
                        buffer: xhr.response,
                        name: Main.extractFilePrefixFromUrl(url)
                    });
                    return;
                }
                deferred.reject(new Error(xhr.status + ' ' + xhr.statusText));
            };
            xhr.onerror = function (e) {
                console.error(e);
                deferred.reject(new Error('could not receive data'));
            };
            xhr.onprogress = function (e) { return progress(e.loaded / e.total); };
            xhr.send(null);
            return deferred.promise;
        };
        Main.loadAsBlob = function (progress, file_or_url) {
            if (file_or_url instanceof File) {
                var file_2 = file_or_url;
                var deferred_1 = m.deferred();
                setTimeout(function () {
                    deferred_1.resolve({
                        buffer: file_2,
                        name: file_2.name.replace(/\..*$/i, '') + '_'
                    });
                }, 0);
                return deferred_1.promise;
            }
            else {
                return this.loadAsBlobFromString(progress, file_or_url);
            }
        };
        return Main;
    }());
    psdtool.Main = Main;
})(psdtool || (psdtool = {}));
(function () {
    var originalStopCallback = Mousetrap.prototype.stopCallback;
    Mousetrap.prototype.stopCallback = function (e, element, combo) {
        if (!this.paused) {
            if (element.classList.contains('psdtool-layer-visible') || element.classList.contains('psdtool-faview-select')) {
                return false;
            }
        }
        return originalStopCallback.call(this, e, element, combo);
    };
    Mousetrap.init();
})();
(function () {
    var main = new psdtool.Main();
    document.addEventListener('DOMContentLoaded', function (e) { return main.init(); }, false);
})();
