'use strict';
var LayerTree;
(function (LayerTree) {
    var Filter = (function () {
        function Filter(treeRoot, psdRoot) {
            var _this = this;
            this.root = new LayerTree.Node(null, null, '', [], 0, null);
            this.nodes = {};
            var path = [];
            var r = function (ul, n, l) {
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
                    var elems = _this.createElements(l[i]);
                    var cn = new LayerTree.Node(elems.input, elems.text, l[i].Name, path, indexes[l[i].SeqID], n);
                    n.children.push(cn);
                    _this.nodes[l[i].SeqID] = cn;
                    cn.li = document.createElement('li');
                    var cul = document.createElement('ul');
                    path.push(cn.internalName);
                    r(cul, cn, l[i].Children);
                    path.pop();
                    cn.li.appendChild(elems.label);
                    cn.li.appendChild(cul);
                    ul.appendChild(cn.li);
                }
            };
            r(treeRoot, this.root, psdRoot.Children);
        }
        Filter.prototype.createElements = function (l) {
            var input = document.createElement('input');
            input.type = 'checkbox';
            input.checked = true;
            input.setAttribute('data-seq', l.SeqID.toString());
            var text = document.createTextNode(l.Name);
            var label = document.createElement('label');
            label.className = 'checkbox';
            label.appendChild(input);
            label.appendChild(text);
            return {
                text: text,
                label: label,
                input: input
            };
        };
        Filter.prototype.getAllNode = function () {
            var r = [];
            var enableNodes = 0;
            var node;
            for (var key in this.nodes) {
                if (!this.nodes.hasOwnProperty(key)) {
                    continue;
                }
                node = this.nodes[key];
                if (!node.disabled) {
                    ++enableNodes;
                    if (node.checked) {
                        r.push(node);
                    }
                }
            }
            if (r.length === enableNodes) {
                return [];
            }
            return r;
        };
        Filter.prototype.serialize = function () {
            var nodes = this.getAllNode();
            if (!nodes.length) {
                return '';
            }
            var i, path = [], pathMap = {};
            for (i = 0; i < nodes.length; ++i) {
                path.push({
                    node: nodes[i],
                    fullPathSlash: nodes[i].fullPath + '/',
                    index: i
                });
                pathMap[nodes[i].fullPath] = true;
            }
            path.sort(function (a, b) {
                return a.fullPathSlash > b.fullPathSlash ? 1 : a.fullPathSlash < b.fullPathSlash ? -1 : 0;
            });
            var j, parts;
            for (i = 0; i < path.length; ++i) {
                // remove hidden layer
                parts = path[i].node.fullPath.split('/');
                for (j = 0; j < parts.length; ++j) {
                    if (!pathMap[parts.slice(0, j + 1).join('/')]) {
                        path.splice(i--, 1);
                        j = -1;
                        break;
                    }
                }
                // remove duplicated entry
                if (j !== -1 && i > 0 && path[i].fullPathSlash.indexOf(path[i - 1].fullPathSlash) === 0) {
                    path.splice(--i, 1);
                }
            }
            path.sort(function (a, b) { return a.index > b.index ? -1 : a.index < b.index ? 1 : 0; });
            parts = [];
            for (i = 0; i < path.length; ++i) {
                parts.push(path[i].node.fullPath);
            }
            return parts.join('\n');
        };
        Filter.prototype.buildDeserializeTree = function (state) {
            var root = {
                children: {},
                checked: true
            };
            var node, parts;
            var lines = state.replace(/\r/g, '').split('\n');
            for (var _i = 0, lines_1 = lines; _i < lines_1.length; _i++) {
                var line = lines_1[_i];
                parts = line.split('/');
                node = root;
                for (var _a = 0, parts_1 = parts; _a < parts_1.length; _a++) {
                    var part = parts_1[_a];
                    if (!(part in node.children)) {
                        node.children[part] = {
                            children: {},
                            checked: true
                        };
                    }
                    node = node.children[part];
                }
            }
            return root;
        };
        Filter.prototype.apply = function (dnode, fnode, useDisable) {
            var founds = {};
            var cdnode;
            for (var _i = 0, _a = fnode.children; _i < _a.length; _i++) {
                var cfnode = _a[_i];
                if (cfnode.disabled) {
                    continue;
                }
                founds[cfnode.internalName] = true;
                if (dnode) {
                    cdnode = dnode.children[cfnode.internalName];
                }
                if (!dnode || !cdnode) {
                    if (useDisable) {
                        cfnode.disabled = true;
                    }
                    cfnode.checked = false;
                    this.apply(null, cfnode, useDisable);
                    continue;
                }
                cfnode.checked = cdnode.checked;
                this.apply(cdnode, cfnode, useDisable);
            }
        };
        Filter.prototype.deserialize = function (state, parents) {
            var old = this.serialize();
            try {
                for (var key in this.nodes) {
                    if (!this.nodes.hasOwnProperty(key)) {
                        continue;
                    }
                    this.nodes[key].disabled = false;
                    this.nodes[key].checked = true;
                }
                for (var i = parents.length - 1; i >= 0; --i) {
                    this.apply(this.buildDeserializeTree(parents[i]), this.root, true);
                }
                if (state === '') {
                    return;
                }
                for (var key in this.nodes) {
                    if (!this.nodes.hasOwnProperty(key)) {
                        continue;
                    }
                    this.nodes[key].checked = false;
                }
                this.apply(this.buildDeserializeTree(state), this.root, false);
            }
            catch (e) {
                this.apply(this.buildDeserializeTree(old), this.root, false);
                throw e;
            }
        };
        return Filter;
    }());
    LayerTree.Filter = Filter;
})(LayerTree || (LayerTree = {}));
