'use strict';
var LayerTree;
(function (LayerTree_1) {
    var Node = (function () {
        function Node(input, displayName_, name_, currentPath, indexInSameName, parent) {
            this.input = input;
            this.displayName_ = displayName_;
            this.name_ = name_;
            this.parent = parent;
            this.children = [];
            this.internalName_ = Node.encodeLayerName(this.name, indexInSameName);
            if (currentPath.length) {
                this.fullPath_ = currentPath.join('/') + '/' + this.internalName_;
            }
            else {
                this.fullPath_ = this.internalName_;
            }
        }
        Object.defineProperty(Node.prototype, "checked", {
            get: function () { return this.input.checked; },
            set: function (v) { this.input.checked = v; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Node.prototype, "disabled", {
            get: function () { return this.input.disabled; },
            set: function (v) { this.input.disabled = v; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Node.prototype, "name", {
            get: function () { return this.name_; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Node.prototype, "displayName", {
            get: function () { return this.displayName_.data; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Node.prototype, "internalName", {
            get: function () { return this.internalName_; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Node.prototype, "fullPath", {
            get: function () { return this.fullPath_; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Node.prototype, "isRoot", {
            get: function () { return !this.input; },
            enumerable: true,
            configurable: true
        });
        Node.encodeLayerName = function (s, index) {
            return s.replace(/[\x00-\x1f\x22\x25\x27\x2f\x5c\x7e\x7f]/g, function (m) {
                return '%' + ('0' + m[0].charCodeAt(0).toString(16)).slice(-2);
            }) + (index === 0 ? '' : '\\' + index.toString());
        };
        return Node;
    }());
    LayerTree_1.Node = Node;
    var LayerTree = (function () {
        function LayerTree(disableExtendedFeature, treeRoot, psdRoot) {
            var _this = this;
            this.disableExtendedFeature = disableExtendedFeature;
            this.root = new Node(null, null, '', [], 0, null);
            this.nodes = {};
            var path = [];
            var r = function (ul, n, l, parentSeqID) {
                var indexes = {};
                var founds = {};
                for (var _i = 0, l_1 = l; _i < l_1.length; _i++) {
                    var ll = l_1[_i];
                    if (ll.Name in founds) {
                        indexes[ll.SeqID] = ++founds[ll.Name];
                    }
                    else {
                        indexes[ll.SeqID] = founds[ll.Name] = 0;
                    }
                }
                for (var i = l.length - 1; i >= 0; --i) {
                    var elems = _this.createElements(l[i], parentSeqID);
                    var cn = new Node(elems.input, elems.text, l[i].Name, path, indexes[l[i].SeqID], n);
                    n.children.push(cn);
                    _this.nodes[l[i].SeqID] = cn;
                    var cul = document.createElement('ul');
                    path.push(cn.internalName);
                    r(cul, cn, l[i].Children, l[i].SeqID);
                    path.pop();
                    cn.li = document.createElement('li');
                    if (l[i].Folder) {
                        cn.li.classList.add('psdtool-folder');
                    }
                    cn.li.appendChild(elems.div);
                    cn.li.appendChild(cul);
                    ul.appendChild(cn.li);
                }
            };
            r(treeRoot, this.root, psdRoot.Children, -1);
            this.registerClippingGroup(psdRoot.Children);
            this.normalize();
        }
        Object.defineProperty(LayerTree.prototype, "text", {
            get: function () {
                var text = [];
                var tab = [];
                var r = function (n) {
                    for (var _i = 0, _a = n.children; _i < _a.length; _i++) {
                        var cn = _a[_i];
                        text.push(tab.join('') + cn.name);
                        tab.push('\t');
                        r(cn);
                        tab.pop();
                    }
                };
                r(this.root);
                return text.join('\n');
            },
            enumerable: true,
            configurable: true
        });
        LayerTree.prototype.createElements = function (l, parentSeqID) {
            var name = document.createElement('label');
            var input = document.createElement('input');
            var layerName = l.Name;
            if (!this.disableExtendedFeature && layerName.length > 1) {
                switch (layerName.charAt(0)) {
                    case '!':
                        input.className = 'psdtool-layer-visible psdtool-layer-force-visible';
                        input.name = 'l' + l.SeqID;
                        input.type = 'checkbox';
                        input.checked = true;
                        input.disabled = true;
                        input.style.display = 'none';
                        layerName = layerName.substring(1);
                        break;
                    case '*':
                        input.className = 'psdtool-layer-visible psdtool-layer-radio';
                        input.name = 'r_' + parentSeqID;
                        input.type = 'radio';
                        input.checked = l.Visible;
                        layerName = layerName.substring(1);
                        break;
                }
            }
            if (!input.name) {
                input.className = 'psdtool-layer-visible';
                input.name = 'l' + l.SeqID;
                input.type = 'checkbox';
                input.checked = l.Visible;
            }
            input.setAttribute('data-seq', l.SeqID.toString());
            name.appendChild(input);
            if (l.Clipping) {
                var clip = document.createElement('img');
                clip.className = 'psdtool-clipped-mark';
                clip.src = 'img/clipped.svg';
                clip.alt = 'clipped mark';
                name.appendChild(clip);
            }
            if (l.Folder) {
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
                if (l.Canvas) {
                    var w = l.Width, h = l.Height;
                    if (w > h) {
                        w = thumb.width;
                        h = thumb.width / l.Width * h;
                    }
                    else {
                        h = thumb.height;
                        w = thumb.height / l.Height * w;
                    }
                    var ctx = thumb.getContext('2d');
                    ctx.drawImage(l.Canvas, (thumb.width - w) / 2, (thumb.height - h) / 2, w, h);
                }
                name.appendChild(thumb);
            }
            var text = document.createTextNode(layerName);
            name.appendChild(text);
            var div = document.createElement('div');
            div.className = 'psdtool-layer-name';
            div.appendChild(name);
            return {
                text: text,
                div: div,
                input: input,
            };
        };
        LayerTree.prototype.updateClass = function () {
            function r(n) {
                if (n.checked) {
                    n.li.classList.remove('psdtool-hidden');
                    if (n.clip) {
                        for (var i = 0; i < n.clip.length; ++i) {
                            n.clip[i].li.classList.remove('psdtool-hidden-by-clipping');
                        }
                    }
                }
                else {
                    n.li.classList.add('psdtool-hidden');
                    if (n.clip) {
                        for (var i = 0; i < n.clip.length; ++i) {
                            n.clip[i].li.classList.add('psdtool-hidden-by-clipping');
                        }
                    }
                }
                for (var i = 0; i < n.children.length; ++i) {
                    r(n.children[i]);
                }
            }
            for (var i = 0; i < this.root.children.length; ++i) {
                r(this.root.children[i]);
            }
        };
        LayerTree.prototype.registerClippingGroup = function (l) {
            var clip = [];
            var n;
            for (var i = l.length - 1; i >= 0; --i) {
                this.registerClippingGroup(l[i].Children);
                n = this.nodes[l[i].SeqID];
                if (l[i].Clipping) {
                    clip.unshift(n);
                }
                else {
                    if (clip.length) {
                        for (var j = 0; j < clip.length; ++j) {
                            clip[j].clippedBy = n;
                        }
                        n.clip = clip;
                    }
                    clip = [];
                }
            }
        };
        LayerTree.prototype.getAllNode = function () {
            var r = [];
            var node;
            for (var key in this.nodes) {
                if (!this.nodes.hasOwnProperty(key)) {
                    continue;
                }
                node = this.nodes[key];
                if (node.checked) {
                    r.push(node);
                }
            }
            return r;
        };
        LayerTree.prototype.serialize = function (allLayer) {
            var nodes = this.getAllNode();
            if (!nodes.length) {
                return '';
            }
            if (allLayer) {
                var r = [];
                for (var _i = 0, nodes_1 = nodes; _i < nodes_1.length; _i++) {
                    var node = nodes_1[_i];
                    r.push('/' + node.fullPath);
                }
                return r.join('\n');
            }
            var i, items = [], pathMap = {};
            for (i = 0; i < nodes.length; ++i) {
                items.push({
                    node: nodes[i],
                    fullPathSlash: nodes[i].fullPath + '/',
                    index: i
                });
                pathMap[nodes[i].fullPath] = true;
            }
            items.sort(function (a, b) {
                return a.fullPathSlash > b.fullPathSlash ? 1 : a.fullPathSlash < b.fullPathSlash ? -1 : 0;
            });
            var j, parts;
            for (i = 0; i < items.length; ++i) {
                // remove hidden layer
                parts = items[i].node.fullPath.split('/');
                for (j = 0; j < parts.length; ++j) {
                    if (!pathMap[parts.slice(0, j + 1).join('/')]) {
                        items.splice(i--, 1);
                        j = -1;
                        break;
                    }
                }
                // remove duplicated entry
                if (j !== -1 && i > 0 && items[i].fullPathSlash.indexOf(items[i - 1].fullPathSlash) === 0) {
                    items.splice(--i, 1);
                }
            }
            items.sort(function (a, b) { return a.index > b.index ? -1 : a.index < b.index ? 1 : 0; });
            parts = [];
            for (var _a = 0, items_1 = items; _a < items_1.length; _a++) {
                var item = items_1[_a];
                parts.push(item.node.fullPath);
            }
            return parts.join('\n');
        };
        LayerTree.prototype.buildDeserializeTree = function (state) {
            var allLayer = state.charAt(0) === '/';
            var root = {
                children: {},
                checked: true,
                allLayer: allLayer
            };
            var j, node, parts;
            var lines = state.replace(/\r/g, '').split('\n');
            for (var _i = 0, lines_1 = lines; _i < lines_1.length; _i++) {
                var line = lines_1[_i];
                parts = line.split('/');
                for (j = allLayer ? 1 : 0, node = root; j < parts.length; ++j) {
                    if (!(parts[j] in node.children)) {
                        node.children[parts[j]] = {
                            children: {},
                            checked: !allLayer
                        };
                    }
                    node = node.children[parts[j]];
                }
                if (allLayer) {
                    node.checked = true;
                }
            }
            return root;
        };
        LayerTree.prototype.apply = function (dnode, fnode) {
            var founds = {};
            var cfnode, cdnode;
            for (var _i = 0, _a = fnode.children; _i < _a.length; _i++) {
                cfnode = _a[_i];
                founds[cfnode.internalName] = true;
                if (dnode) {
                    cdnode = dnode.children[cfnode.internalName];
                }
                if (!dnode || !cdnode) {
                    cfnode.checked = false;
                    this.apply(null, cfnode);
                    continue;
                }
                if (cdnode.checked) {
                    cfnode.checked = true;
                }
                this.apply(cdnode, cfnode);
            }
        };
        LayerTree.prototype.deserialize = function (state) {
            var old = this.serialize(true);
            try {
                var t = this.buildDeserializeTree(state);
                if (t.allLayer) {
                    this.clear();
                    this.normalize();
                }
                this.apply(t, this.root);
            }
            catch (e) {
                this.clear();
                this.normalize();
                this.apply(this.buildDeserializeTree(old), this.root);
                throw e;
            }
        };
        LayerTree.prototype.buildFilterTree = function (filter) {
            var root = {
                children: {}
            };
            var node, parts;
            for (var _i = 0, _a = filter.replace(/\r/g, '').split('\n'); _i < _a.length; _i++) {
                var line = _a[_i];
                parts = line.split('/');
                node = root;
                for (var _b = 0, parts_1 = parts; _b < parts_1.length; _b++) {
                    var part = parts_1[_b];
                    if (!(part in node.children)) {
                        node.children[part] = {
                            children: {}
                        };
                    }
                    node = node.children[part];
                }
            }
            return root;
        };
        LayerTree.prototype.applyWithFilter = function (dnode, filter, fnode) {
            var founds = {};
            var cfnode, cfilter, cdnode;
            for (var _i = 0, _a = fnode.children; _i < _a.length; _i++) {
                cfnode = _a[_i];
                founds[cfnode.internalName] = true;
                if (filter) {
                    cfilter = filter.children[cfnode.internalName];
                }
                if (!filter || !cfilter) {
                    continue;
                }
                if (dnode) {
                    cdnode = dnode.children[cfnode.internalName];
                }
                if (!dnode || !cdnode) {
                    cfnode.checked = false;
                    this.applyWithFilter(null, cfilter, cfnode);
                    continue;
                }
                if (cdnode.checked) {
                    cfnode.checked = true;
                }
                this.applyWithFilter(cdnode, cfilter, cfnode);
            }
        };
        LayerTree.prototype.deserializePartial = function (baseState, overlayState, filter) {
            var old = this.serialize(true);
            try {
                if (baseState !== undefined) {
                    if (baseState === '') {
                        this.clear();
                    }
                    else {
                        var base = this.buildDeserializeTree(baseState);
                        if (base.allLayer) {
                            this.clear();
                            this.normalize();
                        }
                        this.apply(base, this.root);
                    }
                }
                var overlay = this.buildDeserializeTree(overlayState);
                if (overlay.allLayer) {
                    throw new Error('cannot use allLayer mode in LayerTree.deserializePartial');
                }
                this.applyWithFilter(overlay, this.buildFilterTree(filter), this.root);
            }
            catch (e) {
                this.clear();
                this.normalize();
                this.apply(this.buildDeserializeTree(old), this.root);
                throw e;
            }
        };
        LayerTree.prototype.clear = function () {
            for (var key in this.nodes) {
                if (!this.nodes.hasOwnProperty(key)) {
                    continue;
                }
                this.nodes[key].checked = false;
            }
        };
        LayerTree.prototype.normalize = function () {
            // TODO: re-implement
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
                set[radios[i].name] = true;
                var rinShibuyas = ul.querySelectorAll('.psdtool-layer-radio[name="' + radios[i].name + '"]:checked');
                if (!rinShibuyas.length) {
                    radios[i].checked = true;
                    continue;
                }
            }
        };
        return LayerTree;
    }());
    LayerTree_1.LayerTree = LayerTree;
})(LayerTree || (LayerTree = {}));
