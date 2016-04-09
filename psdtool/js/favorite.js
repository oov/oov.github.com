'use strict';
var Favorite;
(function (Favorite_1) {
    (function (FaviewMode) {
        FaviewMode[FaviewMode["ShowLayerTree"] = 0] = "ShowLayerTree";
        FaviewMode[FaviewMode["ShowFaview"] = 1] = "ShowFaview";
        FaviewMode[FaviewMode["ShowFaviewAndReadme"] = 2] = "ShowFaviewAndReadme";
    })(Favorite_1.FaviewMode || (Favorite_1.FaviewMode = {}));
    var FaviewMode = Favorite_1.FaviewMode;
    var JSONBuilder = (function () {
        function JSONBuilder(rootText) {
            this.json_ = [{
                    id: 'root',
                    text: rootText,
                    type: 'root',
                    state: {
                        opened: true
                    },
                    children: []
                }];
        }
        Object.defineProperty(JSONBuilder.prototype, "json", {
            get: function () { return this.json_; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(JSONBuilder.prototype, "root", {
            get: function () { return this.json_[0]; },
            enumerable: true,
            configurable: true
        });
        JSONBuilder.prototype.add = function (name, type, data) {
            var i, j, partName;
            var c = this.json_;
            var nameParts = name.split('/');
            nameParts.unshift(JSONBuilder.encodeName(this.root.text));
            for (i = 0; i < nameParts.length; ++i) {
                partName = JSONBuilder.decodeName(nameParts[i]);
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
                if (i !== nameParts.length - 1) {
                    c.push(JSONBuilder.createNode(partName, 'folder'));
                    c = c[c.length - 1].children;
                    continue;
                }
                c.push(JSONBuilder.createNode(partName, type, data));
            }
        };
        JSONBuilder.createNode = function (text, type, data) {
            switch (type) {
                case 'item':
                    return {
                        text: text,
                        type: type,
                        data: {
                            value: data
                        },
                        children: []
                    };
                case 'folder':
                    return {
                        text: text,
                        type: type,
                        state: {
                            opened: true
                        },
                        children: []
                    };
                case 'filter':
                    return {
                        text: text,
                        type: type,
                        data: {
                            value: data
                        },
                        state: {
                            opened: true
                        },
                        children: []
                    };
            }
            throw new Error('unknown node type: ' + type);
        };
        JSONBuilder.encodeName = function (s) {
            return s.replace(/[\x00-\x1f\x22\x25\x27\x2f\x5c\x7e\x7f]/g, function (m) {
                return '%' + ('0' + m[0].charCodeAt(0).toString(16)).slice(-2);
            });
        };
        JSONBuilder.decodeName = function (s) {
            return decodeURIComponent(s);
        };
        return JSONBuilder;
    }());
    function stringToArrayBuffer(s, complete) {
        var fr = new FileReader();
        fr.onload = function (e) { return complete(fr.result); };
        fr.readAsArrayBuffer(new Blob([s]));
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
    var Favorite = (function () {
        function Favorite(element, defaultRootName, loaded) {
            this.defaultRootName = defaultRootName;
            this.psdHash = '';
            this.faviewMode = 1 /* ShowFaview */;
            this.uniqueId = Date.now().toString() + Math.random().toString().substring(2);
            this.changedTimer = 0;
            this.tree = element;
            this.jq = jQuery(this.tree);
            this.initTree(loaded);
        }
        Object.defineProperty(Favorite.prototype, "rootName", {
            get: function () {
                var root = this.jst.get_node('root');
                if (root && root.text) {
                    return root.text;
                }
                return this.defaultRootName;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Favorite.prototype, "json", {
            get: function () {
                return this.jst.get_json();
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Favorite.prototype, "pfv", {
            get: function () {
                var _this = this;
                var json = this.json;
                if (json.length !== 1) {
                    throw new Error('sorry but favorite tree data is broken');
                }
                var path = [];
                var lines = ['[PSDToolFavorites-v1]'];
                var r = function (children) {
                    for (var _i = 0, children_1 = children; _i < children_1.length; _i++) {
                        var item = children_1[_i];
                        path.push(JSONBuilder.encodeName(item.text));
                        switch (item.type) {
                            case 'root':
                                lines.push('root-name/' + path[0]);
                                lines.push('faview-mode/' + _this.faviewMode.toString());
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
                };
                r(json);
                return lines.join('\n');
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Favorite.prototype, "renameNodes", {
            get: function () {
                var nodes = [];
                var r = function (n, rn) {
                    for (var _i = 0, n_1 = n; _i < n_1.length; _i++) {
                        var cn = n_1[_i];
                        rn.push({
                            id: cn.id,
                            text: cn.text,
                            originalText: cn.text,
                            children: []
                        });
                        r(cn.children, rn[rn.length - 1].children);
                    }
                };
                r(this.json, nodes);
                return nodes;
            },
            enumerable: true,
            configurable: true
        });
        Favorite.prototype.bulkRename = function (nodes) {
            var _this = this;
            var r = function (n, reserve) {
                for (var _i = 0, n_2 = n; _i < n_2.length; _i++) {
                    var cn = n_2[_i];
                    if (cn.originalText !== cn.text) {
                        _this.jst.rename_node(cn.id, reserve ? '_' : cn.text);
                    }
                    r(cn.children, reserve);
                }
            };
            r(nodes, true);
            r(nodes, false);
        };
        Favorite.prototype.jstCheck = function (op, node, parent) {
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
        };
        Favorite.prototype.clearSelection = function () {
            if (this.jst.get_top_selected().length === 0) {
                return;
            }
            this.jst.deselect_all();
            if (this.onClearSelection) {
                this.onClearSelection();
            }
        };
        Favorite.prototype.get = function (id) {
            return this.jst.get_node(id);
        };
        Favorite.prototype.edit = function (id) {
            var target = id;
            if (id === undefined) {
                target = this.jst.get_top_selected();
            }
            this.jst.edit(target);
        };
        Favorite.prototype.update = function (n) {
            var target;
            if ('id' in n) {
                target = this.jst.get_node(n.id);
            }
            else {
                var selected = this.jst.get_top_selected();
                if (!selected.length) {
                    return;
                }
                target = selected[0];
            }
            if ('type' in n) {
                this.jst.set_type(target, n.type);
            }
            if ('data' in n) {
                target.data = n.data;
            }
        };
        Favorite.prototype.getFirstFilter = function (n) {
            for (var _i = 0, _a = this.getParents(n, 'filter'); _i < _a.length; _i++) {
                var p = _a[_i];
                return p.data.value;
            }
            return '';
        };
        Favorite.prototype.getAncestorFilters = function (n) {
            var r = [];
            for (var _i = 0, _a = this.getParents(n, 'filter'); _i < _a.length; _i++) {
                var p = _a[_i];
                r.push(p.data.value);
            }
            return r;
        };
        Favorite.prototype.getParents = function (n, typeFilter) {
            var parents = [];
            for (var p = this.jst.get_node(n.parent); p; p = this.jst.get_node(p.parent)) {
                if (typeFilter === undefined || typeFilter === p.type) {
                    parents.push(p);
                }
            }
            return parents;
        };
        Favorite.prototype.remove = function (id) {
            var target = id;
            if (id === undefined) {
                target = this.jst.get_top_selected();
            }
            this.clearSelection();
            try {
                this.jst.delete_node(target);
            }
            catch (e) {
                // workaround that an error happens when deletes node during editing.
                this.jst.delete_node(this.jst.create_node(null, 'dummy', 'last'));
                this.jst.deselect_all();
            }
        };
        Favorite.prototype.addNode = function (type, edit, text, data) {
            var obj;
            switch (type) {
                case 'item':
                    if (text === undefined || text === '') {
                        text = 'New Item';
                    }
                    obj = {
                        text: text,
                        type: type,
                        data: {
                            value: data
                        },
                        children: []
                    };
                    break;
                case 'folder':
                    if (text === undefined || text === '') {
                        text = 'New Folder';
                    }
                    obj = {
                        text: text,
                        type: type,
                        children: []
                    };
                    break;
                case 'filter':
                    if (text === undefined || text === '') {
                        text = 'New Filter';
                    }
                    obj = {
                        text: text,
                        type: type,
                        children: []
                    };
                    break;
                default:
                    throw new Error('unsupported object type: ' + type);
            }
            // create node
            var selectedList = this.jst.get_top_selected(true);
            if (selectedList.length === 0) {
                return this.jst.create_node('root', obj, 'last');
            }
            var selected = selectedList[0];
            if (selected.type !== 'item') {
                var n = this.jst.create_node(selected, obj, 'last');
                if (!selected.state.opened) {
                    this.jst.open_node(selected, null);
                }
                return n;
            }
            var parent = this.jst.get_node(selected.parent);
            var idx = parent.children.indexOf(selected.id);
            return this.jst.create_node(parent, obj, idx !== -1 ? idx + 1 : 'last');
        };
        Favorite.prototype.add = function (type, edit, text, data) {
            var id = this.addNode(type, edit, text, data);
            this.clearSelection();
            this.jst.select_node(id, true);
            if (edit) {
                this.jst.edit(id);
            }
            return id;
        };
        Favorite.prototype.addFolders = function (names) {
            var ids = [];
            for (var _i = 0, names_1 = names; _i < names_1.length; _i++) {
                var name_1 = names_1[_i];
                ids.push(this.addNode('folder', false, name_1));
            }
            this.clearSelection();
            for (var _a = 0, ids_1 = ids; _a < ids_1.length; _a++) {
                var id = ids_1[_a];
                this.jst.select_node(id, true);
            }
            return ids;
        };
        Favorite.prototype.jstChanged = function () {
            var _this = this;
            if (this.changedTimer) {
                clearTimeout(this.changedTimer);
            }
            this.changedTimer = setTimeout(function () {
                _this.changedTimer = 0;
                if (_this.onModified) {
                    _this.onModified();
                }
                _this.updateLocalStorage();
            }, 32);
        };
        Favorite.prototype.jstSelectionChanged = function () {
            var selectedList = this.jst.get_top_selected(true);
            if (selectedList.length === 0) {
                return;
            }
            var selected = selectedList[0];
            if (selected.type !== 'item') {
                if (this.onClearSelection) {
                    this.onClearSelection();
                }
                return;
            }
            try {
                if (this.onSelect) {
                    this.onSelect(selected);
                }
            }
            catch (e) {
                console.error(e);
                alert(e);
            }
        };
        Favorite.prototype.jstCopyNode = function (e, data) {
            var _this = this;
            var process = function (node, original) {
                var text = _this.suggestUniqueName(node);
                if (node.text !== text) {
                    _this.jst.rename_node(node, text);
                }
                switch (node.type) {
                    case 'item':
                        node.data = { value: original.data.value };
                        break;
                    case 'folder':
                        for (var i = 0; i < node.children.length; ++i) {
                            process(_this.jst.get_node(node.children[i]), _this.jst.get_node(original.children[i]));
                        }
                        break;
                    case 'filter':
                        node.data = { value: original.data.value };
                        for (var i = 0; i < node.children.length; ++i) {
                            process(_this.jst.get_node(node.children[i]), _this.jst.get_node(original.children[i]));
                        }
                        break;
                }
            };
            process(data.node, data.original);
        };
        Favorite.prototype.jstMoveNode = function (e, data) {
            var text = this.suggestUniqueName(data.node, data.text);
            if (data.text !== text) {
                this.jst.rename_node(data.node, text);
            }
        };
        Favorite.prototype.jstCreateNode = function (e, data) {
            var text = this.suggestUniqueName(data.node);
            if (data.node.text !== text) {
                this.jst.rename_node(data.node, text);
            }
        };
        Favorite.prototype.jstRenameNode = function (e, data) {
            var text = this.suggestUniqueName(data.node, data.text);
            if (data.text !== text) {
                this.jst.rename_node(data.node, text);
            }
        };
        Favorite.prototype.jstDoubleClick = function (e) {
            var selected = this.jst.get_node(e.target);
            switch (selected.type) {
                case 'item':
                case 'folder':
                case 'filter':
                    if (this.onDoubleClick) {
                        this.onDoubleClick(selected);
                    }
                    break;
                default:
                    this.jst.toggle_node(selected);
                    break;
            }
        };
        Favorite.prototype.suggestUniqueName = function (node, newText) {
            var n = this.jst.get_node(node);
            var parent = this.jst.get_node(n.parent);
            var nameMap = {};
            for (var _i = 0, _a = parent.children; _i < _a.length; _i++) {
                var pc = _a[_i];
                if (pc === n.id) {
                    continue;
                }
                nameMap[this.jst.get_text(pc)] = true;
            }
            if (newText === undefined) {
                newText = n.text;
            }
            if (!(newText in nameMap)) {
                return newText;
            }
            newText += ' ';
            var i = 2;
            while ((newText + i) in nameMap) {
                ++i;
            }
            return newText + i;
        };
        Favorite.prototype.initTree = function (loaded, data) {
            var _this = this;
            this.jq.jstree('destroy');
            this.jq.jstree({
                core: {
                    animation: false,
                    check_callback: this.jstCheck,
                    dblclick_toggle: false,
                    themes: {
                        dots: false
                    },
                    data: data ? data : new JSONBuilder(this.defaultRootName).json
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
            });
            this.jst = this.jq.jstree();
            this.jq.on('changed.jstree', function (e) { return _this.jstSelectionChanged(); });
            this.jq.on([
                'set_text.jstree',
                'create_node.jstree',
                'rename_node.jstree',
                'delete_node.jstree',
                'move_node.jstree',
                'copy_node.jstree',
                'cut.jstree',
                'paste.jstree'
            ].join(' '), function (e) { return _this.jstChanged(); });
            this.jq.on('copy_node.jstree', function (e, data) { return _this.jstCopyNode(e, data); });
            this.jq.on('move_node.jstree', function (e, data) { return _this.jstMoveNode(e, data); });
            this.jq.on('create_node.jstree', function (e, data) { return _this.jstCreateNode(e, data); });
            this.jq.on('rename_node.jstree', function (e, data) { return _this.jstRenameNode(e, data); });
            this.jq.on('dblclick.jstree', function (e) { return _this.jstDoubleClick(e); });
            this.jq.on('ready.jstree', function (e) {
                if (loaded) {
                    loaded();
                }
            });
        };
        Favorite.prototype.updateLocalStorage = function () {
            var _this = this;
            var pfv = this.pfv;
            stringToArrayBuffer(pfv, function (ab) {
                var pfvs = _this.getPFVListFromLocalStorage();
                var found = false;
                var newUniqueId = 'pfv' + CRC32.crc32(ab).toString(16);
                for (var i = 0; i < pfvs.length; ++i) {
                    if (pfvs[i].id === _this.uniqueId && pfvs[i].hash === _this.psdHash) {
                        pfvs.splice(i, 1);
                        found = true;
                        continue;
                    }
                    if (pfvs[i].id === newUniqueId && pfvs[i].hash === _this.psdHash) {
                        pfvs.splice(i, 1);
                    }
                }
                if (!found && countEntries(pfv) === 0) {
                    return;
                }
                _this.uniqueId = newUniqueId;
                pfvs.push({
                    id: _this.uniqueId,
                    time: new Date().getTime(),
                    hash: _this.psdHash,
                    data: pfv
                });
                while (pfvs.length > 8) {
                    pfvs.shift();
                }
                localStorage['psdtool_pfv'] = JSON.stringify(pfvs);
            });
        };
        Favorite.prototype.getPFVListFromLocalStorage = function () {
            if (!('psdtool_pfv' in localStorage)) {
                return [];
            }
            return JSON.parse(localStorage['psdtool_pfv']);
        };
        Favorite.prototype.getPFVFromLocalStorage = function (hash) {
            var pfvs = this.getPFVListFromLocalStorage();
            if (!pfvs.length) {
                return null;
            }
            for (var i = pfvs.length - 1; i >= 0; --i) {
                if (pfvs[i].hash === hash) {
                    return pfvs[i];
                }
            }
        };
        Favorite.prototype.loadFromArrayBuffer = function (ab) {
            return this.loadFromString(arrayBufferToString(ab), 'pfv' + CRC32.crc32(ab).toString(16));
        };
        Favorite.prototype.loadFromString = function (s, uniqueId) {
            var _this = this;
            var load = function (id) {
                var r = _this.stringToNodeTree(s);
                _this.initTree(function () {
                    _this.uniqueId = id;
                    _this.faviewMode = r.faviewMode;
                    if (_this.onLoaded) {
                        _this.onLoaded();
                    }
                }, r.root);
            };
            if (uniqueId !== undefined) {
                load(uniqueId);
            }
            else {
                stringToArrayBuffer(s, function (ab) {
                    load('pfv' + CRC32.crc32(ab).toString(16));
                });
            }
            return true;
        };
        Favorite.prototype.stringToNodeTree = function (s) {
            var lines = s.replace(/\r/g, '').split('\n');
            if (lines.shift() !== '[PSDToolFavorites-v1]') {
                throw new Error('given PFV file does not have a valid header');
            }
            var jb = new JSONBuilder(this.defaultRootName);
            var setting = {
                'root-name': this.defaultRootName,
                'faview-mode': 2 /* ShowFaviewAndReadme */ .toString(),
            };
            var name, type, data = [], first = true, value;
            for (var _i = 0, lines_1 = lines; _i < lines_1.length; _i++) {
                var line = lines_1[_i];
                if (line === '') {
                    continue;
                }
                if (line.length > 2 && line.substring(0, 2) === '//') {
                    if (first) {
                        jb.root.text = setting['root-name'];
                        first = false;
                    }
                    else {
                        jb.add(name, type, data.join('\n'));
                    }
                    name = line.substring(2);
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
                    name = line.substring(0, line.indexOf('/'));
                    value = JSONBuilder.decodeName(line.substring(name.length + 1));
                    if (value) {
                        setting[name] = value;
                    }
                }
                else {
                    data.push(line);
                }
            }
            if (first) {
                jb.root.text = setting['root-name'];
            }
            else {
                jb.add(name, type, data.join('\n'));
            }
            var faviewMode;
            var n = parseInt(setting['faview-mode'], 10);
            switch (n) {
                case 0 /* ShowLayerTree */:
                case 1 /* ShowFaview */:
                case 2 /* ShowFaviewAndReadme */:
                    faviewMode = n;
                    break;
                default:
                    faviewMode = 2 /* ShowFaviewAndReadme */;
                    break;
            }
            return {
                root: jb.json,
                faviewMode: faviewMode
            };
        };
        return Favorite;
    }());
    Favorite_1.Favorite = Favorite;
    function countEntries(pfv) {
        var c = 0;
        var lines = pfv.replace(/\r/g, '').split('\n');
        lines.shift();
        for (var _i = 0, lines_2 = lines; _i < lines_2.length; _i++) {
            var line = lines_2[_i];
            if (line.length > 2 && line.substring(0, 2) === '//') {
                ++c;
            }
        }
        return c;
    }
    Favorite_1.countEntries = countEntries;
    var Faview = (function () {
        function Faview(favorite, rootSel, root) {
            var _this = this;
            this.favorite = favorite;
            this.rootSel = rootSel;
            this.root = root;
            this.closed_ = true;
            this.treeRoots = [];
            root.addEventListener('click', function (e) { return _this.click(e); }, false);
            root.addEventListener('change', function (e) { return _this.change(e); }, false);
            root.addEventListener('input', function (e) { return _this.input(e); }, false);
            root.addEventListener('keyup', function (e) { return _this.keyup(e); }, false);
            rootSel.addEventListener('change', function (e) { return _this.change(e); }, false);
            rootSel.addEventListener('keyup', function (e) { return _this.keyup(e); }, false);
        }
        Object.defineProperty(Faview.prototype, "roots", {
            get: function () {
                return this.treeRoots.length;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Faview.prototype, "closed", {
            get: function () {
                return this.closed_;
            },
            enumerable: true,
            configurable: true
        });
        Faview.prototype.serialize = function () {
            var result = {
                rootSelectedValue: this.rootSel.value,
                items: {}
            };
            for (var i = 0; i < this.treeRoots.length; ++i) {
                var item = {};
                var selects = this.treeRoots[i].getElementsByTagName('select');
                for (var i_1 = 0; i_1 < selects.length; ++i_1) {
                    item[selects[i_1].getAttribute('data-id')] = {
                        value: selects[i_1].value,
                        lastMod: parseInt(selects[i_1].getAttribute('data-lastmod'), 10)
                    };
                }
                var opt = this.rootSel.options[i];
                if (opt instanceof HTMLOptionElement) {
                    result.items[opt.value] = item;
                }
            }
            return result;
        };
        Faview.prototype.deserialize = function (state) {
            for (var i = 0; i < this.rootSel.length; ++i) {
                var opt = this.rootSel.options[i];
                if (opt instanceof HTMLOptionElement && opt.value in state.items) {
                    var item = state.items[opt.value];
                    var elems = this.treeRoots[i].getElementsByTagName('select');
                    for (var i_2 = 0; i_2 < elems.length; ++i_2) {
                        var elem = elems[i_2];
                        if (elem instanceof HTMLSelectElement) {
                            var id = elem.getAttribute('data-id');
                            if (!(id in item)) {
                                continue;
                            }
                            for (var j = 0; j < elem.length; ++j) {
                                var opt_1 = elem.options[j];
                                if (opt_1 instanceof HTMLOptionElement && opt_1.value === item[id].value) {
                                    elem.selectedIndex = j;
                                    elem.setAttribute('data-lastmod', item[id].lastMod.toString());
                                    var range = elem.parentElement.querySelector('input[type=range]');
                                    if (range instanceof HTMLInputElement) {
                                        range.value = j.toString();
                                    }
                                    break;
                                }
                            }
                        }
                    }
                    if (state.rootSelectedValue === opt.value) {
                        this.rootSel.selectedIndex = i;
                    }
                }
            }
        };
        Faview.prototype.rootChanged = function () {
            for (var i = 0; i < this.treeRoots.length; ++i) {
                if (this.rootSel.selectedIndex !== i) {
                    this.treeRoots[i].style.display = 'none';
                    continue;
                }
                this.treeRoots[i].style.display = 'block';
            }
            if (this.onRootChanged) {
                this.onRootChanged();
            }
        };
        Faview.prototype.changed = function (select) {
            select.setAttribute('data-lastmod', Date.now().toString());
            var range = select.parentElement.querySelector('input[type=range]');
            if (range instanceof HTMLInputElement) {
                range.value = select.selectedIndex.toString();
            }
            if (this.onChange) {
                this.onChange(this.favorite.get(select.value));
            }
        };
        Faview.prototype.keyup = function (e) {
            var target = e.target;
            if (target instanceof HTMLSelectElement) {
                // it is a workaround for Firefox that does not fire change event by keyboard input
                target.blur();
                target.focus();
            }
        };
        Faview.prototype.change = function (e) {
            var target = e.target;
            if (target instanceof HTMLSelectElement) {
                if (target === this.rootSel) {
                    this.rootChanged();
                    return;
                }
                this.changed(target);
            }
            else if (target instanceof HTMLInputElement && target.type === 'range') {
                var sel = target.parentElement.querySelector('select');
                if (sel instanceof HTMLSelectElement) {
                    sel.selectedIndex = parseInt(target.value, 10);
                    this.changed(sel);
                }
            }
        };
        Faview.prototype.input = function (e) {
            var target = e.target;
            if (target instanceof HTMLInputElement && target.type === 'range') {
                var sel = target.parentElement.querySelector('select');
                if (sel instanceof HTMLSelectElement) {
                    sel.selectedIndex = parseInt(target.value, 10);
                    this.changed(sel);
                }
            }
        };
        Faview.prototype.click = function (e) {
            var target = e.target;
            if (target instanceof HTMLButtonElement) {
                var mv = 0;
                if (target.classList.contains('psdtool-faview-prev')) {
                    mv = -1;
                }
                else if (target.classList.contains('psdtool-faview-next')) {
                    mv = 1;
                }
                if (mv === 0) {
                    return;
                }
                var sel = target.parentElement.querySelector('select');
                if (sel instanceof HTMLSelectElement) {
                    sel.selectedIndex = (sel.length + sel.selectedIndex + mv) % sel.length;
                    sel.focus();
                    this.changed(sel);
                }
            }
        };
        Faview.prototype.addNode = function (n, ul) {
            var li = document.createElement('li');
            var span = document.createElement('span');
            span.className = 'glyphicon glyphicon-asterisk';
            li.appendChild(span);
            li.appendChild(document.createTextNode(n.text.replace(/^\*?/, ' ')));
            ul.appendChild(li);
            var sel = document.createElement('select');
            sel.className = 'form-control psdtool-faview-select';
            sel.setAttribute('data-id', n.id);
            var cul = document.createElement('ul');
            var opt;
            var firstItemId;
            var numItems = 0, numChild = 0;
            for (var _i = 0, _a = n.children; _i < _a.length; _i++) {
                var cn = _a[_i];
                if (typeof cn !== 'string') {
                    switch (cn.type) {
                        case 'item':
                            opt = document.createElement('option');
                            opt.textContent = cn.text;
                            opt.value = cn.id;
                            if (++numItems === 1) {
                                firstItemId = cn.id;
                            }
                            sel.appendChild(opt);
                            break;
                        case 'folder':
                        case 'filter':
                            this.addNode(cn, cul);
                            ++numChild;
                            break;
                    }
                }
            }
            // show filtered entry only
            if (numItems > 0 && this.favorite.getFirstFilter(this.favorite.get(firstItemId)) !== '') {
                var range = document.createElement('input');
                range.type = 'range';
                range.max = (numItems - 1).toString();
                range.value = '0';
                var prev = document.createElement('button');
                prev.className = 'btn btn-default psdtool-faview-prev';
                prev.innerHTML = '&lt;';
                prev.tabIndex = -1;
                var next = document.createElement('button');
                next.className = 'btn btn-default psdtool-faview-next';
                next.innerHTML = '&gt;';
                next.tabIndex = -1;
                var fs = document.createElement('div');
                fs.className = 'psdtool-faview-select-container';
                if (numItems === 1) {
                    prev.disabled = true;
                    sel.disabled = true;
                    range.disabled = true;
                    next.disabled = true;
                }
                fs.appendChild(prev);
                fs.appendChild(sel);
                fs.appendChild(range);
                fs.appendChild(next);
                li.appendChild(fs);
            }
            if (numChild > 0) {
                li.appendChild(cul);
            }
        };
        Faview.prototype.addRoot = function (nodes) {
            var opt;
            for (var _i = 0, nodes_1 = nodes; _i < nodes_1.length; _i++) {
                var n = nodes_1[_i];
                if (n.text.length > 1 && n.text.charAt(0) === '*') {
                    opt = document.createElement('option');
                    opt.value = n.id;
                    opt.textContent = n.text.substring(1);
                    this.rootSel.appendChild(opt);
                    var ul = document.createElement('ul');
                    for (var _a = 0, _b = n.children; _a < _b.length; _a++) {
                        var cn = _b[_a];
                        if (typeof cn !== 'string') {
                            switch (cn.type) {
                                case 'folder':
                                case 'filter':
                                    this.addNode(cn, ul);
                            }
                        }
                    }
                    var li = document.createElement('li');
                    li.style.display = 'none';
                    li.appendChild(ul);
                    this.treeRoots.push(li);
                    this.root.appendChild(li);
                    var selects = li.getElementsByTagName('select');
                    for (var i = 0; i < selects.length; ++i) {
                        selects[i].setAttribute('data-lastmod', (selects.length - i).toString());
                    }
                }
                this.addRoot(n.children);
            }
        };
        Faview.prototype.start = function (state) {
            this.treeRoots = [];
            this.rootSel.innerHTML = '';
            this.root.innerHTML = '';
            this.addRoot(this.favorite.json);
            if (state !== undefined) {
                this.deserialize(state);
            }
            if (this.roots > 0) {
                this.rootChanged();
            }
            this.closed_ = false;
        };
        Faview.prototype.refresh = function () {
            this.start(this.serialize());
        };
        Faview.prototype.getActive = function () {
            var selects = this.treeRoots[this.rootSel.selectedIndex].getElementsByTagName('select');
            var items = [];
            for (var i = 0; i < selects.length; ++i) {
                items.push({
                    n: this.favorite.get(selects[i].value),
                    lastMod: parseInt(selects[i].getAttribute('data-lastmod'), 10)
                });
            }
            items.sort(function (a, b) { return a.lastMod === b.lastMod ? 0
                : a.lastMod < b.lastMod ? -1 : 1; });
            var nodes = [];
            for (var _i = 0, items_1 = items; _i < items_1.length; _i++) {
                var i = items_1[_i];
                nodes.push(i.n);
            }
            return nodes;
        };
        Faview.prototype.close = function () {
            this.treeRoots = [];
            this.rootSel.innerHTML = '';
            this.root.innerHTML = '';
            this.closed_ = true;
        };
        return Faview;
    }());
    Favorite_1.Faview = Faview;
    var CRC32 = (function () {
        function CRC32() {
        }
        // Based on http://stackoverflow.com/a/18639999
        CRC32.makeCRCTable = function () {
            var c, n, k;
            var crcTable = new Uint32Array(256);
            for (n = 0; n < 256; n++) {
                c = n;
                for (k = 0; k < 8; k++) {
                    c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
                }
                crcTable[n] = c;
            }
            return crcTable;
        };
        CRC32.crc32 = function (src) {
            var crcTable = CRC32.crcTable;
            var u8a = new Uint8Array(src);
            var crc = 0 ^ (-1);
            for (var i = 0; i < u8a.length; i++) {
                crc = (crc >>> 8) ^ crcTable[(crc ^ u8a[i]) & 0xFF];
            }
            return (crc ^ (-1)) >>> 0;
        };
        CRC32.crcTable = CRC32.makeCRCTable();
        return CRC32;
    }());
})(Favorite || (Favorite = {}));
