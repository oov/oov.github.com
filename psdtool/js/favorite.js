'use strict';
var Favorite;
(function (Favorite_1) {
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
        function Favorite(element, defaultRootName) {
            this.defaultRootName = defaultRootName;
            this.psdHash = '';
            this.uniqueId = Date.now().toString() + Math.random().toString().substring(2);
            this.changedTimer = 0;
            this.tree = element;
            this.jq = jQuery(this.tree);
            this.initTree();
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
                return buildPFV(this.json);
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
            var r = function (n) {
                for (var _i = 0, n_2 = n; _i < n_2.length; _i++) {
                    var cn = n_2[_i];
                    if (cn.originalText !== cn.text) {
                        _this.jst.rename_node(cn.id, cn.text);
                    }
                    r(cn.children);
                }
            };
            r(nodes);
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
            return false;
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
        Favorite.prototype.getParents = function (n) {
            var parents = [];
            for (var p = this.jst.get_node(n.parent); p; p = this.jst.get_node(p.parent)) {
                parents.push(p);
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
        Favorite.prototype.updateLocalStorage = function () {
            var p = this.pfv;
            var pfvs = [];
            if ('psdtool_pfv' in localStorage) {
                pfvs = JSON.parse(localStorage['psdtool_pfv']);
            }
            var found = false;
            for (var i = 0; i < pfvs.length; ++i) {
                if (pfvs[i].id === this.uniqueId && pfvs[i].hash === this.psdHash) {
                    pfvs.splice(i, 1);
                    found = true;
                    break;
                }
            }
            if (!found && countEntries(p) === 0) {
                return;
            }
            pfvs.push({
                id: this.uniqueId,
                time: new Date().getTime(),
                hash: this.psdHash,
                data: p
            });
            while (pfvs.length > 8) {
                pfvs.shift();
            }
            localStorage['psdtool_pfv'] = JSON.stringify(pfvs);
        };
        Favorite.prototype.jstChanged = function () {
            var _this = this;
            if (this.changedTimer) {
                clearTimeout(this.changedTimer);
            }
            this.changedTimer = setTimeout(function () {
                _this.changedTimer = 0;
                _this.updateLocalStorage();
            }, 100);
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
                        node.data.value = original.data.value;
                        break;
                    case 'folder':
                        for (var i = 0; i < node.children.length; ++i) {
                            process(_this.jst.get_node(node.children[i]), _this.jst.get_node(original.children[i]));
                        }
                        break;
                    case 'filter':
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
        Favorite.prototype.initTree = function (data) {
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
            this.jq.on('changed.jstree', this.jstSelectionChanged.bind(this));
            this.jq.on([
                'set_text.jstree',
                'create_node.jstree',
                'rename_node.jstree',
                'delete_node.jstree',
                'move_node.jstree',
                'copy_node.jstree',
                'cut.jstree',
                'paste.jstree'
            ].join(' '), this.jstChanged.bind(this));
            this.jq.on('copy_node.jstree', this.jstCopyNode.bind(this));
            this.jq.on('move_node.jstree', this.jstMoveNode.bind(this));
            this.jq.on('create_node.jstree', this.jstCreateNode.bind(this));
            this.jq.on('rename_node.jstree', this.jstRenameNode.bind(this));
            this.jq.on('dblclick.jstree', this.jstDoubleClick.bind(this));
        };
        Favorite.prototype.loadFromArrayBuffer = function (ab, uniqueId) {
            return this.loadFromString(arrayBufferToString(ab), uniqueId);
        };
        Favorite.prototype.loadFromLocalStorage = function (hash) {
            if (!('psdtool_pfv' in localStorage)) {
                return false;
            }
            var pfv = JSON.parse(localStorage['psdtool_pfv']);
            for (var i = pfv.length - 1; i >= 0; --i) {
                if (pfv[i].hash === hash) {
                    return this.loadFromString(pfv[i].data, pfv[i].id);
                }
            }
            return false;
        };
        Favorite.prototype.loadFromString = function (s, uniqueId) {
            this.initTree(this.stringToNodeTree(s));
            if (uniqueId !== undefined) {
                this.uniqueId = uniqueId;
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
                'root-name': this.defaultRootName
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
            return jb.json;
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
    function buildPFV(json) {
        if (json.length !== 1) {
            throw new Error('sorry but favorite tree data is broken');
        }
        var path = [];
        var lines = ['[PSDToolFavorites-v1]'];
        function r(children) {
            for (var _i = 0, children_1 = children; _i < children_1.length; _i++) {
                var item = children_1[_i];
                path.push(JSONBuilder.encodeName(item.text));
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
})(Favorite || (Favorite = {}));
