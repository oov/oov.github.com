'use strict';
var tileder;
(function (tileder) {
    var Image = (function () {
        function Image(data, tileSet) {
            this.name = data.name;
            this.width = data.width;
            this.height = data.height;
            this.originalWidth = data.originalWidth;
            this.originalHeight = data.originalHeight;
            this.tileWidth = data.tileWidth;
            this.tileHeight = data.tileHeight;
            this.data = data.data;
            this.deflated = data.deflated;
            this.tileSet = tileSet;
        }
        Image.prototype.export = function (fileFormat, tileFormat, useTSX) {
            if (this.deflated && tileFormat !== 'binz') {
                throw new Error("cannot export by '" + tileFormat + "' when have the compressed data");
            }
            if (!this.deflated && tileFormat === 'binz') {
                throw new Error("cannot export by '" + tileFormat + "' when have the uncompressed data");
            }
            switch (fileFormat) {
                case 'tmx':
                    return this.exportTMX(tileFormat, useTSX);
                case 'json':
                    return this.exportJSON(tileFormat, useTSX);
                case 'js':
                    return this.exportJS(tileFormat, useTSX);
                case 'raw':
                    return this.exportRaw(tileFormat);
            }
            throw new Error('unknown file format: ' + fileFormat);
        };
        Image.prototype.exportRaw = function (tileFormat) {
            switch (tileFormat) {
                case 'csv':
                    return new Blob([int32ArrayToCSV(new Int32Array(this.data), this.width, '\n')], { type: 'text/csv; charset=utf-8' });
                case 'bin':
                    return new Blob([this.data], { type: 'application/octet-binary' });
                default:
                    throw new Error('unknown tile format: ' + tileFormat);
            }
        };
        Image.prototype.exportJSON = function (tileFormat, useTSX) {
            var ts = [];
            var path = new Array(this.name.split('\\').length).join('..\\');
            for (var i = 0; i < this.tileSet.length; ++i) {
                if (useTSX) {
                    ts.push(this.tileSet[i].getTileSetReference(path));
                }
                else {
                    ts.push(this.tileSet[i].getTileSet(path));
                }
            }
            var o = {
                width: this.width,
                height: this.height,
                tilewidth: this.tileWidth,
                tileheight: this.tileHeight,
                nextobjectid: 1,
                orientation: 'orthogonal',
                renderorder: 'right-down',
                version: 1,
                propertytypes: {
                    originalwidth: 'int',
                    originalheight: 'int'
                },
                properties: {
                    originalwidth: this.originalWidth,
                    originalheight: this.originalHeight
                },
                tilesets: ts,
                layers: [{
                        height: this.height,
                        name: this.name,
                        opacity: 1,
                        type: 'tilelayer',
                        visible: true,
                        width: this.width,
                        x: 0,
                        y: 0
                    }]
            };
            switch (tileFormat) {
                case 'csv':
                    o.layers[0].data = Array.prototype.slice.call(new Int32Array(this.data));
                    break;
                case 'bin':
                    o.layers[0].encoding = 'base64';
                    o.layers[0].data = arrayBufferToString(Base64.encode(this.data));
                    break;
                case 'binz':
                    o.layers[0].encoding = 'base64';
                    o.layers[0].compression = 'zlib';
                    o.layers[0].data = arrayBufferToString(Base64.encode(this.data));
                    break;
                default:
                    throw new Error('unknown tile format: ' + tileFormat);
            }
            return new Blob([JSON.stringify(o)], { type: 'application/json; charset=utf-8' });
        };
        Image.prototype.exportJS = function (tileFormat, useTSX) {
            return new Blob(["(function(name,data){\n if(typeof onTileMapLoaded === 'undefined') {\n  if(typeof TileMaps === 'undefined') TileMaps = {};\n  TileMaps[name] = data;\n } else {\n  onTileMapLoaded(name, data);\n }})(",
                JSON.stringify(this.name), ", ", this.exportJSON(tileFormat, useTSX), ');'], { type: 'text/javascript; charset=utf-8' });
        };
        Image.prototype.exportTMX = function (tileFormat, useTSX) {
            var xml = [
                "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n",
                "<map version=\"1.0\" orientation=\"orthogonal\" renderorder=\"right-down\"",
                (" width=\"" + this.width + "\" height=\"" + this.height + "\""),
                (" tilewidth=\"" + this.tileWidth + "\" tileheight=\"" + this.tileHeight + "\" nextobjectid=\"1\">\n"),
                "\t<properties>\n",
                ("\t\t<property name=\"originalWidth\" type=\"int\" value=\"" + this.originalWidth + "\"/>\n"),
                ("\t\t<property name=\"originalHeight\" type=\"int\" value=\"" + this.originalHeight + "\"/>\n"),
                "\t</properties>\n"
            ];
            var path = new Array(this.name.split('\\').length).join('..\\');
            for (var i = 0; i < this.tileSet.length; ++i) {
                if (useTSX) {
                    xml.push("\t" + this.tileSet[i].getTileSetReferenceTag(path) + "\n");
                }
                else {
                    xml.push("\t" + this.tileSet[i].getTileSetTag(path) + "\n");
                }
            }
            xml.push("\t<layer name=\"" + this.name + "\" width=\"" + this.width + "\" height=\"" + this.height + "\">\n");
            switch (tileFormat) {
                case 'csv':
                    xml.push("\t\t<data encoding=\"csv\">\n");
                    xml.push(int32ArrayToCSV(new Int32Array(this.data), this.width, ',\n'));
                    break;
                case 'xml':
                    xml.push("\t\t<data>\n");
                    xml.push(int32ArrayToXML(new Int32Array(this.data), '\t\t\t', '\n'));
                    break;
                case 'bin':
                    xml.push("\t\t<data encoding=\"base64\">\n\t\t\t");
                    xml.push(Base64.encode(this.data));
                    break;
                case 'binz':
                    xml.push("\t\t<data encoding=\"base64\" compression=\"zlib\">\n\t\t\t");
                    xml.push(Base64.encode(this.data));
                    break;
                default:
                    throw new Error('unknown tile format: ' + tileFormat);
            }
            xml.push("\n\t\t</data>\n\t</layer>\n</map>");
            return new Blob(xml, { type: 'text/xml; charset=utf-8' });
        };
        return Image;
    }());
    tileder.Image = Image;
    var Tsx = (function () {
        function Tsx(data, gid, filename) {
            this.tileWidth = data.tileWidth;
            this.tileHeight = data.tileHeight;
            this.tileCount = data.tileCount;
            this.columns = data.columns;
            this.width = data.width;
            this.height = data.height;
            this.data = data.data;
            this.gid = gid;
            this.filename = filename;
        }
        Tsx.prototype.getImage = function (doc) {
            var src = new Uint8Array(this.data);
            var imageSize = Math.sqrt(src.length >> 2);
            var image = doc.createElement('canvas');
            image.width = imageSize;
            image.height = imageSize;
            var ctx = image.getContext('2d');
            if (!ctx) {
                throw new Error('cannot get CanvasRenderingContext2D');
            }
            var imageData = ctx.createImageData(imageSize, imageSize);
            var dest = imageData.data, sw = imageSize * 4, dw = imageData.width * 4;
            for (var y = 0; y < imageSize; ++y) {
                var sx = y * sw, dx = y * dw;
                for (var x = 0; x < sw; ++x) {
                    dest[dx + x] = src[sx + x];
                }
            }
            ctx.putImageData(imageData, 0, 0);
            return image;
        };
        Tsx.prototype.export = function () {
            return "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<tileset name=\"" + this.filename + "\" tilewidth=\"" + this.tileWidth + "\" tileheight=\"" + this.tileHeight + "\" tilecount=\"" + this.tileCount + "\" columns=\"" + this.columns + "\">\n   <image source=\"" + this.filename + ".png\" width=\"" + this.width + "\" height=\"" + this.height + "\"/>\n</tileset>";
        };
        Tsx.prototype.getTileSetReferenceTag = function (path) {
            return "<tileset firstgid=\"" + this.gid + "\" source=\"" + path + this.filename + ".tsx\"/>";
        };
        Tsx.prototype.getTileSetTag = function (path) {
            return ("<tileset firstgid=\"" + this.gid + "\" name=\"" + this.filename + "\"") +
                (" tilewidth=\"" + this.tileWidth + "\" tileheight=\"" + this.tileHeight + "\"") +
                (" tilecount=\"" + this.tileCount + "\" columns=\"" + this.columns + "\">") +
                ("<image source=\"" + path + this.filename + ".png\" width=\"" + this.width + "\" height=\"" + this.height + "\"/>") +
                "</tileset>";
        };
        Tsx.prototype.getTileSetReference = function (path) {
            return {
                firstgid: this.gid,
                source: path + this.filename + '.tsx'
            };
        };
        Tsx.prototype.getTileSet = function (path) {
            return {
                columns: this.columns,
                firstgid: this.gid,
                image: path + this.filename + '.png',
                imageheight: this.height,
                imagewidth: this.width,
                margin: 0,
                name: this.filename,
                spacing: 0,
                tilecount: this.tileCount,
                tileheight: this.tileHeight,
                tilewidth: this.tileWidth
            };
        };
        return Tsx;
    }());
    tileder.Tsx = Tsx;
    function int32ArrayToXML(a, prefix, postfix) {
        var r = new Array(a.length);
        for (var i = 0; i < a.length; ++i) {
            r[i] = "<tile gid=\"" + a[i].toString() + "\"/>";
        }
        return prefix + r.join(prefix + postfix) + postfix;
    }
    function int32ArrayToCSV(a, width, sep) {
        var r = new Array(a.length - (a.length / (width - 1)) | 0);
        for (var i = 0, j = 0, n = 0; i < a.length; ++i, ++j, ++n) {
            if (n + 1 === width && i + 1 < a.length) {
                r[j] = a[i].toString() + sep + a[++i].toString();
                n = 0;
                continue;
            }
            r[j] = a[i].toString();
        }
        return r.join(',');
    }
    var Tileder = (function () {
        function Tileder() {
            var _this = this;
            this.queue = [];
            this.tileSet = [];
            this.gid = 1;
            this.w = new Worker(Tileder.getScriptName());
            this.w.onmessage = function (e) { return _this.onMessage(e); };
        }
        Tileder.getScriptName = function () {
            if (Tileder.scriptName) {
                return Tileder.scriptName;
            }
            var elem = document.getElementById('tileder');
            if (!elem) {
                return 'tileder.js';
            }
            return elem.getAttribute('src') || 'tileder.js';
        };
        Tileder.prototype.onMessage = function (e) {
            switch (e.data.type) {
                case 'add':
                    this.onAdd();
                    break;
                case 'tsx':
                    this.onTsx(e.data.t, e.data.i, e.data.n);
                    break;
                case 'image':
                    this.onImage(e.data.img, e.data.i, e.data.n);
                    break;
            }
        };
        // private adding: () => void;
        Tileder.prototype.add = function (name, image, next) {
            var ctx;
            if (image instanceof HTMLImageElement) {
                var cvs = document.createElement('canvas');
                cvs.width = image.width;
                cvs.height = image.height;
                ctx = cvs.getContext('2d');
                if (ctx) {
                    ctx.drawImage(image, 0, 0);
                }
            }
            else {
                ctx = image.getContext('2d');
            }
            if (!ctx) {
                throw new Error('cannot get CanvasRenderingContext2D');
            }
            var imgData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
            // this.adding = next;
            var q = this.queue.length > 5;
            if (q) {
                this.queue.push(next);
            }
            else {
                this.queue.push(undefined);
                setTimeout(next, 0);
            }
            this.w.postMessage({
                type: 'add',
                n: name,
                b: imgData.data.buffer,
                w: ctx.canvas.width,
                h: ctx.canvas.height
            }, [imgData.data.buffer]);
        };
        Tileder.prototype.onAdd = function () {
            // this.adding();
            var f = this.queue.shift();
            if (f) {
                setTimeout(f, 0);
            }
        };
        Tileder.prototype.finish = function (compressMap, tsx, image, complete) {
            this.tsxHandler = tsx;
            this.imageHandler = image;
            this.completeHandler = complete;
            this.w.postMessage({
                type: 'finish',
                c: compressMap,
            });
            this.tileSet = [];
            this.gid = 1;
        };
        Tileder.prototype.onTsx = function (tsx, index, total) {
            var t = new Tsx(tsx, this.gid, index.toString());
            this.tileSet.push(t);
            this.gid += tsx.tileCount;
            this.tsxHandler(t, index / total);
        };
        Tileder.prototype.onImage = function (image, index, total) {
            var i = new Image(image, this.tileSet);
            this.imageHandler(i, index / total);
            if (index === total - 1) {
                this.completeHandler();
            }
        };
        return Tileder;
    }());
    tileder.Tileder = Tileder;
    var TilederWorker = (function () {
        function TilederWorker(g) {
            this.g = g;
            this.tileSize = 16;
            this.tile = {};
            this.images = [];
        }
        ;
        TilederWorker.prototype.onMessage = function (e) {
            switch (e.data.type) {
                case 'add':
                    this.onAdd(e.data.n, e.data.b, e.data.w, e.data.h);
                    break;
                case 'finish':
                    this.onFinish(e.data.c);
                    break;
            }
        };
        TilederWorker.prototype.calcImageSize = function (n) {
            var x = n * this.tileSize * this.tileSize;
            for (var p = 64; p <= 1024; p += p) {
                if (x <= p * p) {
                    return p;
                }
            }
            return 1024;
        };
        TilederWorker.prototype.buildTsx = function (r) {
            var tile = this.tile, tileSize = this.tileSize;
            var a = Object.keys(tile).map(function (key) { return tile[key]; }), aLen = a.length;
            a.sort(function (a, b) {
                return a.p === b.p ? 0 : a.p < b.p ? -1 : 1;
            });
            var aPos = 0, numTsxes = 0;
            while (aPos < aLen) {
                var bLen = this.calcImageSize(aLen - aPos) >> 4;
                aPos += bLen * bLen;
                ++numTsxes;
            }
            aPos = 0;
            var map = {};
            for (var i = 0; i < numTsxes; ++i) {
                var size = this.calcImageSize(aLen - aPos), size4 = size * 4, columns = size / tileSize;
                var image = new Uint8Array(size * size4);
                var bLen = size >> 4;
                for (var by = 0; by < bLen && aPos < aLen; ++by) {
                    var dy = by * tileSize;
                    for (var bx = 0; bx < bLen && aPos < aLen; ++bx) {
                        var src = a[aPos], srcBuf = src.b;
                        if (!srcBuf) {
                            throw new Error('unexpected undefined buffer');
                        }
                        for (var y = 0; y < tileSize; ++y) {
                            var dx = ((dy + y) * size + bx * tileSize) * 4;
                            var sx = y * tileSize * 4;
                            for (var x = 0; x < tileSize * 4; x += 4) {
                                image[dx + x + 0] = srcBuf[sx + x + 0];
                                image[dx + x + 1] = srcBuf[sx + x + 1];
                                image[dx + x + 2] = srcBuf[sx + x + 2];
                                image[dx + x + 3] = srcBuf[sx + x + 3];
                            }
                        }
                        map[src.h] = aPos++;
                    }
                }
                r({
                    tileWidth: tileSize,
                    tileHeight: tileSize,
                    tileCount: columns * columns,
                    columns: columns,
                    width: size,
                    height: size,
                    data: image.buffer
                }, i, numTsxes);
            }
            this.tile = {};
            return map;
        };
        TilederWorker.prototype.onFinish = function (compressMap) {
            var _this = this;
            var map = this.buildTsx(function (tsx, index, total) {
                _this.g.postMessage({ type: 'tsx', t: tsx, i: index, n: total }, [tsx.data]);
            });
            for (var i = 0; i < this.images.length; ++i) {
                var image = this.images[i];
                var d = new Uint32Array(image.data);
                for (var j = 0; j < d.length; ++j) {
                    d[j] = map[d[j]] + 1;
                }
                if (compressMap) {
                    image.data = pako.deflate(image.data).buffer;
                    image.deflated = true;
                }
                this.g.postMessage({ type: 'image', img: image, i: i, n: this.images.length }, [image.data]);
            }
        };
        TilederWorker.prototype.onAdd = function (fileName, b, w, h) {
            var tile = this.tile;
            var tileSize = this.tileSize, tileSize4 = tileSize << 2;
            var ab = new Uint8ClampedArray(b);
            var buf = new Uint8Array(4 * tileSize * tileSize);
            var bwf = Math.floor(w / tileSize), bhf = Math.floor(h / tileSize);
            var bwc = Math.ceil(w / tileSize), bhc = Math.ceil(h / tileSize);
            var restw = w - bwf * tileSize, resth = h - bwf * tileSize;
            var imageHash = new Uint32Array(bwc * bhc);
            for (var by = 0; by < bhf; ++by) {
                var sy = by * tileSize;
                for (var bx = 0; bx < bwf; ++bx) {
                    for (var y = 0; y < tileSize; ++y) {
                        var sx = ((sy + y) * w + bx * tileSize) * 4;
                        var dx = y * tileSize * 4;
                        for (var x = 0; x < tileSize * 4; x += 4) {
                            buf[dx + x + 0] = ab[sx + x + 0];
                            buf[dx + x + 1] = ab[sx + x + 1];
                            buf[dx + x + 2] = ab[sx + x + 2];
                            buf[dx + x + 3] = ab[sx + x + 3];
                        }
                    }
                    var hash = CRC32.crc32(buf.buffer);
                    if (!(hash in tile)) {
                        tile[hash] = { h: hash, p: by * 1000000 + bx, b: new Uint8Array(buf) };
                    }
                    imageHash[by * bwc + bx] = hash;
                }
            }
            if (restw) {
                buf.fill(0);
                for (var by = 0; by < bhf; ++by) {
                    var sy = by * tileSize;
                    for (var y = 0; y < tileSize; ++y) {
                        var sx = ((sy + y) * w + bwf * tileSize) * 4;
                        var dx = y * tileSize4;
                        for (var x = 0; x < restw * 4; x += 4) {
                            buf[dx + x + 0] = ab[sx + x + 0];
                            buf[dx + x + 1] = ab[sx + x + 1];
                            buf[dx + x + 2] = ab[sx + x + 2];
                            buf[dx + x + 3] = ab[sx + x + 3];
                        }
                    }
                    var hash = CRC32.crc32(buf.buffer);
                    if (!(hash in tile)) {
                        tile[hash] = { h: hash, p: by * 1000000 + bwf, b: new Uint8Array(buf) };
                    }
                    imageHash[by * bwc + bwf] = hash;
                }
            }
            if (resth) {
                buf.fill(0);
                var sy = bhf * tileSize;
                for (var bx = 0; bx < bwf; ++bx) {
                    for (var y = 0; y < resth; ++y) {
                        var sx = ((sy + y) * w + bx * tileSize) * 4;
                        var dx = y * tileSize4;
                        for (var x = 0; x < tileSize4; x += 4) {
                            buf[dx + x + 0] = ab[sx + x + 0];
                            buf[dx + x + 1] = ab[sx + x + 1];
                            buf[dx + x + 2] = ab[sx + x + 2];
                            buf[dx + x + 3] = ab[sx + x + 3];
                        }
                    }
                    var hash = CRC32.crc32(buf.buffer);
                    if (!(hash in tile)) {
                        tile[hash] = { h: hash, p: bhf * 1000000 + bx, b: new Uint8Array(buf) };
                    }
                    imageHash[bhf * bwc + bx] = hash;
                }
            }
            if (restw && resth) {
                buf.fill(0);
                var sy = bhf * tileSize;
                for (var y = 0; y < resth; ++y) {
                    var sx = ((sy + y) * w + bwf * tileSize) * 4;
                    var dx = y * tileSize4;
                    for (var x = 0; x < restw * 4; x += 4) {
                        buf[dx + x + 0] = ab[sx + x + 0];
                        buf[dx + x + 1] = ab[sx + x + 1];
                        buf[dx + x + 2] = ab[sx + x + 2];
                        buf[dx + x + 3] = ab[sx + x + 3];
                    }
                }
                var hash = CRC32.crc32(buf.buffer);
                if (!(hash in tile)) {
                    tile[hash] = { h: hash, p: bhf * 1000000 + bwf, b: new Uint8Array(buf) };
                }
                imageHash[bhf * bwc + bwf] = hash;
            }
            this.images.push({
                name: fileName,
                width: bwc,
                height: bhc,
                originalWidth: w,
                originalHeight: h,
                tileWidth: tileSize,
                tileHeight: tileSize,
                data: imageHash.buffer,
                deflated: false
            });
            this.g.postMessage({ type: 'add' });
        };
        return TilederWorker;
    }());
    function getViewer() {
        return "<!DOCTYPE html>\n<meta charset=\"utf-8\">\n<title>Tiled Viewer</title>\n<style>\nbody{margin:0}\n#ui,#view{float:left}\n#selects{padding:0 0.5em}\n#selects li{padding:0;margin:0 0 1em 0;list-style:none}\n#selects select,input[type=range]{display:block;margin: 2px 0;min-width:192px}\n#view{background-image: url(data:image/gif;base64,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)}\n</style>\n<div id=\"ui\">\n  <div id=\"root\"></div>\n  <ul id=\"selects\"></ul>\n</div>\n<canvas id=\"view\"></canvas>\n<script>\nvar tileMapLoadedCallbacks = {};\nfunction onTileMapLoaded(name, data) {\n  if (!(name in tileMapLoadedCallbacks)) {\n    return;\n  }\n  tileMapLoadedCallbacks[name](data);\n  delete tileMapLoadedCallbacks[name];\n}\nfunction loadTileMap(url, callback){\n  var m = url.match(/\\..+$/);\n  switch (m && m[0]) {\n  case '.json':\n    var xhr = new XMLHttpRequest();\n    xhr.open('GET', url, true);\n    xhr.onload = function(e) {\n      callback(JSON.parse(this.response));\n    };\n    xhr.send();\n    return;\n  case '.js':\n    tileMapLoadedCallbacks[url.replace(/\\//g, '\\\\').replace(/\\..+$/, '')] = callback;\n    var sc = document.createElement('script');\n    sc.src = url;\n    document.body.appendChild(sc);\n    setTimeout(function(){\n      document.body.removeChild(sc);\n    }, 0);\n    return;\n  }\n  throw new Error('unsupported filetype: '+url);\n}\nfunction decodeData(layer){\n  if (!('encoding' in layer)) {\n    return layer.data;\n  }\n  switch (layer.encoding) {\n  case 'base64':\n    var ab = base64ToArrayBuffer(layer.data);\n    if ('compression' in layer) {\n      switch (layer.compression) {\n      case 'zlib':\n        ab = pako.inflate(ab).buffer;\n        break;\n      default:\n        throw new Error('unsupported compression: '+layer.compression);\n      }\n    }\n    var i32a = new Int32Array(ab), r = new Array(i32a.length);\n    for (var i = 0; i < i32a.length; ++i) {\n      r[i] = i32a[i];\n    }\n    return r;\n  default:\n    throw new Error('unsupported encoding: '+layer.encoding);\n  }\n}\nfunction base64ToArrayBuffer(s){\n  var bin = atob(s), u8a = new Uint8Array(bin.length);\n  for (var i = 0; i < bin.length; ++i) {\n    u8a[i] = bin.charCodeAt(i);\n  }\n  return u8a.buffer;\n}\nvar selectId = 0;\nfunction createSelect(caption, items, onChange){\n  var id = 'sel' + (++selectId);\n\n  var label = document.createElement('label');\n  label.textContent = caption;\n  label.htmlFor = id;\n\n  var sel = document.createElement('select');\n  sel.id = id;\n  items.map(function(item, index){\n    var opt = document.createElement('option');\n    opt.textContent = item;\n    opt.value = item;\n    sel.appendChild(opt);\n  });\n\n  var slider = document.createElement('input');\n  slider.type = 'range';\n  slider.max = items.length-1;\n  slider.value = 0;\n\n  sel.addEventListener('change', function(e){\n    slider.value = sel.selectedIndex;\n    onChange(e);\n  }, false);\n  slider.addEventListener('input', function(e){\n    sel.selectedIndex = slider.value;\n    var ev = document.createEvent(\"HTMLEvents\");\n    ev.initEvent(\"change\", false, true);\n    sel.dispatchEvent(ev);\n  }, false);\n\n  var li = document.createElement('li');\n  li.appendChild(label);\n  li.appendChild(sel);\n  li.appendChild(slider);\n  return li;\n}\nfunction updateSelects(faview, rootIndex) {\n  var elem = document.getElementById('selects');\n  elem.innerHTML = '';\n  function changed(){\n    updateCanvas(faview, document.getElementById('view'));\n  }\n  var root = faview.roots[rootIndex];\n  root.selects.map(function(sel, i){\n    elem.appendChild(createSelect(root.captions[i], sel, changed));\n  });\n}\nfunction buildName(flatten, namingStyle, ext) {\n  var items = [], sels = document.querySelectorAll('select');\n  for (var i = 0; i < sels.length; ++i){\n    switch (namingStyle) {\n    case 'standard':\n      items.push(\n        (i ? document.querySelector(\"label[for='\"+sels[i].id+\"']\").textContent+'-' : '')+\n        sels[i].options[sels[i].selectedIndex].value\n      );\n      break;\n    case 'compact':\n      items.push(sels[i].options[sels[i].selectedIndex].value);\n      break;\n    case 'index':\n      items.push(sels[i].selectedIndex);\n      break;\n    }\n  }\n  return items.join(flatten ? '_' : '/') + '.' + ext;\n}\nfunction renderCanvas(tiled, canvas, images, layer){\n  var tsx = tiled.tilesets, tw = tiled.tilewidth, th = tiled.tileheight;\n  canvas.width = tiled.properties.originalwidth;\n  canvas.height = tiled.properties.originalheight;\n  var ctx = canvas.getContext('2d');\n  var dx = 0, dy = 0, data = decodeData(layer);\n  for (var i = 0; i < data.length; ++i) {\n    var d = data[i]-1, img = 0;\n    while(d >= tsx[img].tilecount) {\n      d -= tsx[img++].tilecount;\n    }\n    var sx = d % tsx[img].columns, sy = (d - sx) / tsx[img].columns;\n    ctx.drawImage(images[img], sx * tw, sy * th, tw, th, dx * tw, dy * th, tw, th);\n    if (++dx == layer.width) {\n      dx = 0;\n      ++dy;\n    }\n  }\n}\nfunction updateCanvas(faview, canvas){\n  var path = buildName(faview.flatten, faview.namingStyle, faview.format);\n  loadTileMap(path, function(tiled){\n    var images, loading = 0;\n    function loaded(){\n      if (--loading) return;\n      tiled.layers.map(function(layer){\n        renderCanvas(tiled, canvas, images, layer);\n      });\n    }\n    images = tiled.tilesets.map(function(tsx){\n      ++loading;\n      var img = new Image();\n      img.src = path.replace(/[^\\/]+$/, '') + tsx.image.replace(/\\\\/g, '/');\n      img.onload = loaded;\n      return img;\n    });\n  });\n}\nfunction onFaviewLoaded(faview){\n  var sel = document.createElement('select');\n  faview.roots.map(function(root){\n    var opt = document.createElement('option');\n    opt.textContent = root.name;\n    opt.value = root.name;\n    sel.appendChild(opt);\n  });\n  sel.addEventListener('change', function(e){\n    updateSelects(faview, e.currentTarget.selectedIndex);\n  }, false);\n  if (faview.roots.length <= 1) {\n    sel.style.display = 'none';\n  }\n  document.getElementById('root').appendChild(sel);\n  updateSelects(faview, 0);\n  updateCanvas(faview, document.getElementById('view'));\n}\n</script>\n<script>\n/* pako 1.0.3 nodeca/pako */\n!function(e){if(\"object\"==typeof exports&&\"undefined\"!=typeof module)module.exports=e();else if(\"function\"==typeof define&&define.amd)define([],e);else{var t;t=\"undefined\"!=typeof window?window:\"undefined\"!=typeof global?global:\"undefined\"!=typeof self?self:this,t.pako=e()}}(function(){return function e(t,i,n){function a(o,s){if(!i[o]){if(!t[o]){var f=\"function\"==typeof require&&require;if(!s&&f)return f(o,!0);if(r)return r(o,!0);var l=new Error(\"Cannot find module '\"+o+\"'\");throw l.code=\"MODULE_NOT_FOUND\",l}var d=i[o]={exports:{}};t[o][0].call(d.exports,function(e){var i=t[o][1][e];return a(i?i:e)},d,d.exports,e,t,i,n)}return i[o].exports}for(var r=\"function\"==typeof require&&require,o=0;o<n.length;o++)a(n[o]);return a}({1:[function(e,t,i){\"use strict\";var n=\"undefined\"!=typeof Uint8Array&&\"undefined\"!=typeof Uint16Array&&\"undefined\"!=typeof Int32Array;i.assign=function(e){for(var t=Array.prototype.slice.call(arguments,1);t.length;){var i=t.shift();if(i){if(\"object\"!=typeof i)throw new TypeError(i+\"must be non-object\");for(var n in i)i.hasOwnProperty(n)&&(e[n]=i[n])}}return e},i.shrinkBuf=function(e,t){return e.length===t?e:e.subarray?e.subarray(0,t):(e.length=t,e)};var a={arraySet:function(e,t,i,n,a){if(t.subarray&&e.subarray)return void e.set(t.subarray(i,i+n),a);for(var r=0;r<n;r++)e[a+r]=t[i+r]},flattenChunks:function(e){var t,i,n,a,r,o;for(n=0,t=0,i=e.length;t<i;t++)n+=e[t].length;for(o=new Uint8Array(n),a=0,t=0,i=e.length;t<i;t++)r=e[t],o.set(r,a),a+=r.length;return o}},r={arraySet:function(e,t,i,n,a){for(var r=0;r<n;r++)e[a+r]=t[i+r]},flattenChunks:function(e){return[].concat.apply([],e)}};i.setTyped=function(e){e?(i.Buf8=Uint8Array,i.Buf16=Uint16Array,i.Buf32=Int32Array,i.assign(i,a)):(i.Buf8=Array,i.Buf16=Array,i.Buf32=Array,i.assign(i,r))},i.setTyped(n)},{}],2:[function(e,t,i){\"use strict\";function n(e,t){if(t<65537&&(e.subarray&&o||!e.subarray&&r))return String.fromCharCode.apply(null,a.shrinkBuf(e,t));for(var i=\"\",n=0;n<t;n++)i+=String.fromCharCode(e[n]);return i}var a=e(\"./common\"),r=!0,o=!0;try{String.fromCharCode.apply(null,[0])}catch(e){r=!1}try{String.fromCharCode.apply(null,new Uint8Array(1))}catch(e){o=!1}for(var s=new a.Buf8(256),f=0;f<256;f++)s[f]=f>=252?6:f>=248?5:f>=240?4:f>=224?3:f>=192?2:1;s[254]=s[254]=1,i.string2buf=function(e){var t,i,n,r,o,s=e.length,f=0;for(r=0;r<s;r++)i=e.charCodeAt(r),55296===(64512&i)&&r+1<s&&(n=e.charCodeAt(r+1),56320===(64512&n)&&(i=65536+(i-55296<<10)+(n-56320),r++)),f+=i<128?1:i<2048?2:i<65536?3:4;for(t=new a.Buf8(f),o=0,r=0;o<f;r++)i=e.charCodeAt(r),55296===(64512&i)&&r+1<s&&(n=e.charCodeAt(r+1),56320===(64512&n)&&(i=65536+(i-55296<<10)+(n-56320),r++)),i<128?t[o++]=i:i<2048?(t[o++]=192|i>>>6,t[o++]=128|63&i):i<65536?(t[o++]=224|i>>>12,t[o++]=128|i>>>6&63,t[o++]=128|63&i):(t[o++]=240|i>>>18,t[o++]=128|i>>>12&63,t[o++]=128|i>>>6&63,t[o++]=128|63&i);return t},i.buf2binstring=function(e){return n(e,e.length)},i.binstring2buf=function(e){for(var t=new a.Buf8(e.length),i=0,n=t.length;i<n;i++)t[i]=e.charCodeAt(i);return t},i.buf2string=function(e,t){var i,a,r,o,f=t||e.length,l=new Array(2*f);for(a=0,i=0;i<f;)if(r=e[i++],r<128)l[a++]=r;else if(o=s[r],o>4)l[a++]=65533,i+=o-1;else{for(r&=2===o?31:3===o?15:7;o>1&&i<f;)r=r<<6|63&e[i++],o--;o>1?l[a++]=65533:r<65536?l[a++]=r:(r-=65536,l[a++]=55296|r>>10&1023,l[a++]=56320|1023&r)}return n(l,a)},i.utf8border=function(e,t){var i;for(t=t||e.length,t>e.length&&(t=e.length),i=t-1;i>=0&&128===(192&e[i]);)i--;return i<0?t:0===i?t:i+s[e[i]]>t?i:t}},{\"./common\":1}],3:[function(e,t,i){\"use strict\";function n(e,t,i,n){for(var a=65535&e|0,r=e>>>16&65535|0,o=0;0!==i;){o=i>2e3?2e3:i,i-=o;do a=a+t[n++]|0,r=r+a|0;while(--o);a%=65521,r%=65521}return a|r<<16|0}t.exports=n},{}],4:[function(e,t,i){\"use strict\";t.exports={Z_NO_FLUSH:0,Z_PARTIAL_FLUSH:1,Z_SYNC_FLUSH:2,Z_FULL_FLUSH:3,Z_FINISH:4,Z_BLOCK:5,Z_TREES:6,Z_OK:0,Z_STREAM_END:1,Z_NEED_DICT:2,Z_ERRNO:-1,Z_STREAM_ERROR:-2,Z_DATA_ERROR:-3,Z_BUF_ERROR:-5,Z_NO_COMPRESSION:0,Z_BEST_SPEED:1,Z_BEST_COMPRESSION:9,Z_DEFAULT_COMPRESSION:-1,Z_FILTERED:1,Z_HUFFMAN_ONLY:2,Z_RLE:3,Z_FIXED:4,Z_DEFAULT_STRATEGY:0,Z_BINARY:0,Z_TEXT:1,Z_UNKNOWN:2,Z_DEFLATED:8}},{}],5:[function(e,t,i){\"use strict\";function n(){for(var e,t=[],i=0;i<256;i++){e=i;for(var n=0;n<8;n++)e=1&e?3988292384^e>>>1:e>>>1;t[i]=e}return t}function a(e,t,i,n){var a=r,o=n+i;e^=-1;for(var s=n;s<o;s++)e=e>>>8^a[255&(e^t[s])];return e^-1}var r=n();t.exports=a},{}],6:[function(e,t,i){\"use strict\";function n(){this.text=0,this.time=0,this.xflags=0,this.os=0,this.extra=null,this.extra_len=0,this.name=\"\",this.comment=\"\",this.hcrc=0,this.done=!1}t.exports=n},{}],7:[function(e,t,i){\"use strict\";var n=30,a=12;t.exports=function(e,t){var i,r,o,s,f,l,d,u,c,h,b,w,m,k,_,g,v,p,x,y,S,E,B,Z,A;i=e.state,r=e.next_in,Z=e.input,o=r+(e.avail_in-5),s=e.next_out,A=e.output,f=s-(t-e.avail_out),l=s+(e.avail_out-257),d=i.dmax,u=i.wsize,c=i.whave,h=i.wnext,b=i.window,w=i.hold,m=i.bits,k=i.lencode,_=i.distcode,g=(1<<i.lenbits)-1,v=(1<<i.distbits)-1;e:do{m<15&&(w+=Z[r++]<<m,m+=8,w+=Z[r++]<<m,m+=8),p=k[w&g];t:for(;;){if(x=p>>>24,w>>>=x,m-=x,x=p>>>16&255,0===x)A[s++]=65535&p;else{if(!(16&x)){if(0===(64&x)){p=k[(65535&p)+(w&(1<<x)-1)];continue t}if(32&x){i.mode=a;break e}e.msg=\"invalid literal/length code\",i.mode=n;break e}y=65535&p,x&=15,x&&(m<x&&(w+=Z[r++]<<m,m+=8),y+=w&(1<<x)-1,w>>>=x,m-=x),m<15&&(w+=Z[r++]<<m,m+=8,w+=Z[r++]<<m,m+=8),p=_[w&v];i:for(;;){if(x=p>>>24,w>>>=x,m-=x,x=p>>>16&255,!(16&x)){if(0===(64&x)){p=_[(65535&p)+(w&(1<<x)-1)];continue i}e.msg=\"invalid distance code\",i.mode=n;break e}if(S=65535&p,x&=15,m<x&&(w+=Z[r++]<<m,m+=8,m<x&&(w+=Z[r++]<<m,m+=8)),S+=w&(1<<x)-1,S>d){e.msg=\"invalid distance too far back\",i.mode=n;break e}if(w>>>=x,m-=x,x=s-f,S>x){if(x=S-x,x>c&&i.sane){e.msg=\"invalid distance too far back\",i.mode=n;break e}if(E=0,B=b,0===h){if(E+=u-x,x<y){y-=x;do A[s++]=b[E++];while(--x);E=s-S,B=A}}else if(h<x){if(E+=u+h-x,x-=h,x<y){y-=x;do A[s++]=b[E++];while(--x);if(E=0,h<y){x=h,y-=x;do A[s++]=b[E++];while(--x);E=s-S,B=A}}}else if(E+=h-x,x<y){y-=x;do A[s++]=b[E++];while(--x);E=s-S,B=A}for(;y>2;)A[s++]=B[E++],A[s++]=B[E++],A[s++]=B[E++],y-=3;y&&(A[s++]=B[E++],y>1&&(A[s++]=B[E++]))}else{E=s-S;do A[s++]=A[E++],A[s++]=A[E++],A[s++]=A[E++],y-=3;while(y>2);y&&(A[s++]=A[E++],y>1&&(A[s++]=A[E++]))}break}}break}}while(r<o&&s<l);y=m>>3,r-=y,m-=y<<3,w&=(1<<m)-1,e.next_in=r,e.next_out=s,e.avail_in=r<o?5+(o-r):5-(r-o),e.avail_out=s<l?257+(l-s):257-(s-l),i.hold=w,i.bits=m}},{}],8:[function(e,t,i){\"use strict\";function n(e){return(e>>>24&255)+(e>>>8&65280)+((65280&e)<<8)+((255&e)<<24)}function a(){this.mode=0,this.last=!1,this.wrap=0,this.havedict=!1,this.flags=0,this.dmax=0,this.check=0,this.total=0,this.head=null,this.wbits=0,this.wsize=0,this.whave=0,this.wnext=0,this.window=null,this.hold=0,this.bits=0,this.length=0,this.offset=0,this.extra=0,this.lencode=null,this.distcode=null,this.lenbits=0,this.distbits=0,this.ncode=0,this.nlen=0,this.ndist=0,this.have=0,this.next=null,this.lens=new _.Buf16(320),this.work=new _.Buf16(288),this.lendyn=null,this.distdyn=null,this.sane=0,this.back=0,this.was=0}function r(e){var t;return e&&e.state?(t=e.state,e.total_in=e.total_out=t.total=0,e.msg=\"\",t.wrap&&(e.adler=1&t.wrap),t.mode=D,t.last=0,t.havedict=0,t.dmax=32768,t.head=null,t.hold=0,t.bits=0,t.lencode=t.lendyn=new _.Buf32(we),t.distcode=t.distdyn=new _.Buf32(me),t.sane=1,t.back=-1,z):C}function o(e){var t;return e&&e.state?(t=e.state,t.wsize=0,t.whave=0,t.wnext=0,r(e)):C}function s(e,t){var i,n;return e&&e.state?(n=e.state,t<0?(i=0,t=-t):(i=(t>>4)+1,t<48&&(t&=15)),t&&(t<8||t>15)?C:(null!==n.window&&n.wbits!==t&&(n.window=null),n.wrap=i,n.wbits=t,o(e))):C}function f(e,t){var i,n;return e?(n=new a,e.state=n,n.window=null,i=s(e,t),i!==z&&(e.state=null),i):C}function l(e){return f(e,_e)}function d(e){if(ge){var t;for(m=new _.Buf32(512),k=new _.Buf32(32),t=0;t<144;)e.lens[t++]=8;for(;t<256;)e.lens[t++]=9;for(;t<280;)e.lens[t++]=7;for(;t<288;)e.lens[t++]=8;for(x(S,e.lens,0,288,m,0,e.work,{bits:9}),t=0;t<32;)e.lens[t++]=5;x(E,e.lens,0,32,k,0,e.work,{bits:5}),ge=!1}e.lencode=m,e.lenbits=9,e.distcode=k,e.distbits=5}function u(e,t,i,n){var a,r=e.state;return null===r.window&&(r.wsize=1<<r.wbits,r.wnext=0,r.whave=0,r.window=new _.Buf8(r.wsize)),n>=r.wsize?(_.arraySet(r.window,t,i-r.wsize,r.wsize,0),r.wnext=0,r.whave=r.wsize):(a=r.wsize-r.wnext,a>n&&(a=n),_.arraySet(r.window,t,i-n,a,r.wnext),n-=a,n?(_.arraySet(r.window,t,i-n,n,0),r.wnext=n,r.whave=r.wsize):(r.wnext+=a,r.wnext===r.wsize&&(r.wnext=0),r.whave<r.wsize&&(r.whave+=a))),0}function c(e,t){var i,a,r,o,s,f,l,c,h,b,w,m,k,we,me,ke,_e,ge,ve,pe,xe,ye,Se,Ee,Be=0,Ze=new _.Buf8(4),Ae=[16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15];if(!e||!e.state||!e.output||!e.input&&0!==e.avail_in)return C;i=e.state,i.mode===X&&(i.mode=W),s=e.next_out,r=e.output,l=e.avail_out,o=e.next_in,a=e.input,f=e.avail_in,c=i.hold,h=i.bits,b=f,w=l,ye=z;e:for(;;)switch(i.mode){case D:if(0===i.wrap){i.mode=W;break}for(;h<16;){if(0===f)break e;f--,c+=a[o++]<<h,h+=8}if(2&i.wrap&&35615===c){i.check=0,Ze[0]=255&c,Ze[1]=c>>>8&255,i.check=v(i.check,Ze,2,0),c=0,h=0,i.mode=F;break}if(i.flags=0,i.head&&(i.head.done=!1),!(1&i.wrap)||(((255&c)<<8)+(c>>8))%31){e.msg=\"incorrect header check\",i.mode=ce;break}if((15&c)!==U){e.msg=\"unknown compression method\",i.mode=ce;break}if(c>>>=4,h-=4,xe=(15&c)+8,0===i.wbits)i.wbits=xe;else if(xe>i.wbits){e.msg=\"invalid window size\",i.mode=ce;break}i.dmax=1<<xe,e.adler=i.check=1,i.mode=512&c?q:X,c=0,h=0;break;case F:for(;h<16;){if(0===f)break e;f--,c+=a[o++]<<h,h+=8}if(i.flags=c,(255&i.flags)!==U){e.msg=\"unknown compression method\",i.mode=ce;break}if(57344&i.flags){e.msg=\"unknown header flags set\",i.mode=ce;break}i.head&&(i.head.text=c>>8&1),512&i.flags&&(Ze[0]=255&c,Ze[1]=c>>>8&255,i.check=v(i.check,Ze,2,0)),c=0,h=0,i.mode=L;case L:for(;h<32;){if(0===f)break e;f--,c+=a[o++]<<h,h+=8}i.head&&(i.head.time=c),512&i.flags&&(Ze[0]=255&c,Ze[1]=c>>>8&255,Ze[2]=c>>>16&255,Ze[3]=c>>>24&255,i.check=v(i.check,Ze,4,0)),c=0,h=0,i.mode=H;case H:for(;h<16;){if(0===f)break e;f--,c+=a[o++]<<h,h+=8}i.head&&(i.head.xflags=255&c,i.head.os=c>>8),512&i.flags&&(Ze[0]=255&c,Ze[1]=c>>>8&255,i.check=v(i.check,Ze,2,0)),c=0,h=0,i.mode=M;case M:if(1024&i.flags){for(;h<16;){if(0===f)break e;f--,c+=a[o++]<<h,h+=8}i.length=c,i.head&&(i.head.extra_len=c),512&i.flags&&(Ze[0]=255&c,Ze[1]=c>>>8&255,i.check=v(i.check,Ze,2,0)),c=0,h=0}else i.head&&(i.head.extra=null);i.mode=j;case j:if(1024&i.flags&&(m=i.length,m>f&&(m=f),m&&(i.head&&(xe=i.head.extra_len-i.length,i.head.extra||(i.head.extra=new Array(i.head.extra_len)),_.arraySet(i.head.extra,a,o,m,xe)),512&i.flags&&(i.check=v(i.check,a,m,o)),f-=m,o+=m,i.length-=m),i.length))break e;i.length=0,i.mode=K;case K:if(2048&i.flags){if(0===f)break e;m=0;do xe=a[o+m++],i.head&&xe&&i.length<65536&&(i.head.name+=String.fromCharCode(xe));while(xe&&m<f);if(512&i.flags&&(i.check=v(i.check,a,m,o)),f-=m,o+=m,xe)break e}else i.head&&(i.head.name=null);i.length=0,i.mode=P;case P:if(4096&i.flags){if(0===f)break e;m=0;do xe=a[o+m++],i.head&&xe&&i.length<65536&&(i.head.comment+=String.fromCharCode(xe));while(xe&&m<f);if(512&i.flags&&(i.check=v(i.check,a,m,o)),f-=m,o+=m,xe)break e}else i.head&&(i.head.comment=null);i.mode=Y;case Y:if(512&i.flags){for(;h<16;){if(0===f)break e;f--,c+=a[o++]<<h,h+=8}if(c!==(65535&i.check)){e.msg=\"header crc mismatch\",i.mode=ce;break}c=0,h=0}i.head&&(i.head.hcrc=i.flags>>9&1,i.head.done=!0),e.adler=i.check=0,i.mode=X;break;case q:for(;h<32;){if(0===f)break e;f--,c+=a[o++]<<h,h+=8}e.adler=i.check=n(c),c=0,h=0,i.mode=G;case G:if(0===i.havedict)return e.next_out=s,e.avail_out=l,e.next_in=o,e.avail_in=f,i.hold=c,i.bits=h,N;e.adler=i.check=1,i.mode=X;case X:if(t===Z||t===A)break e;case W:if(i.last){c>>>=7&h,h-=7&h,i.mode=le;break}for(;h<3;){if(0===f)break e;f--,c+=a[o++]<<h,h+=8}switch(i.last=1&c,c>>>=1,h-=1,3&c){case 0:i.mode=J;break;case 1:if(d(i),i.mode=ie,t===A){c>>>=2,h-=2;break e}break;case 2:i.mode=$;break;case 3:e.msg=\"invalid block type\",i.mode=ce}c>>>=2,h-=2;break;case J:for(c>>>=7&h,h-=7&h;h<32;){if(0===f)break e;f--,c+=a[o++]<<h,h+=8}if((65535&c)!==(c>>>16^65535)){e.msg=\"invalid stored block lengths\",i.mode=ce;break}if(i.length=65535&c,c=0,h=0,i.mode=Q,t===A)break e;case Q:i.mode=V;case V:if(m=i.length){if(m>f&&(m=f),m>l&&(m=l),0===m)break e;_.arraySet(r,a,o,m,s),f-=m,o+=m,l-=m,s+=m,i.length-=m;break}i.mode=X;break;case $:for(;h<14;){if(0===f)break e;f--,c+=a[o++]<<h,h+=8}if(i.nlen=(31&c)+257,c>>>=5,h-=5,i.ndist=(31&c)+1,c>>>=5,h-=5,i.ncode=(15&c)+4,c>>>=4,h-=4,i.nlen>286||i.ndist>30){e.msg=\"too many length or distance symbols\",i.mode=ce;break}i.have=0,i.mode=ee;case ee:for(;i.have<i.ncode;){for(;h<3;){if(0===f)break e;f--,c+=a[o++]<<h,h+=8}i.lens[Ae[i.have++]]=7&c,c>>>=3,h-=3}for(;i.have<19;)i.lens[Ae[i.have++]]=0;if(i.lencode=i.lendyn,i.lenbits=7,Se={bits:i.lenbits},ye=x(y,i.lens,0,19,i.lencode,0,i.work,Se),i.lenbits=Se.bits,ye){e.msg=\"invalid code lengths set\",i.mode=ce;break}i.have=0,i.mode=te;case te:for(;i.have<i.nlen+i.ndist;){for(;Be=i.lencode[c&(1<<i.lenbits)-1],me=Be>>>24,ke=Be>>>16&255,_e=65535&Be,!(me<=h);){if(0===f)break e;f--,c+=a[o++]<<h,h+=8}if(_e<16)c>>>=me,h-=me,i.lens[i.have++]=_e;else{if(16===_e){for(Ee=me+2;h<Ee;){if(0===f)break e;f--,c+=a[o++]<<h,h+=8}if(c>>>=me,h-=me,0===i.have){e.msg=\"invalid bit length repeat\",i.mode=ce;break}xe=i.lens[i.have-1],m=3+(3&c),c>>>=2,h-=2}else if(17===_e){for(Ee=me+3;h<Ee;){if(0===f)break e;f--,c+=a[o++]<<h,h+=8}c>>>=me,h-=me,xe=0,m=3+(7&c),c>>>=3,h-=3}else{for(Ee=me+7;h<Ee;){if(0===f)break e;f--,c+=a[o++]<<h,h+=8}c>>>=me,h-=me,xe=0,m=11+(127&c),c>>>=7,h-=7}if(i.have+m>i.nlen+i.ndist){e.msg=\"invalid bit length repeat\",i.mode=ce;break}for(;m--;)i.lens[i.have++]=xe}}if(i.mode===ce)break;if(0===i.lens[256]){e.msg=\"invalid code -- missing end-of-block\",i.mode=ce;break}if(i.lenbits=9,Se={bits:i.lenbits},ye=x(S,i.lens,0,i.nlen,i.lencode,0,i.work,Se),i.lenbits=Se.bits,ye){e.msg=\"invalid literal/lengths set\",i.mode=ce;break}if(i.distbits=6,i.distcode=i.distdyn,Se={bits:i.distbits},ye=x(E,i.lens,i.nlen,i.ndist,i.distcode,0,i.work,Se),i.distbits=Se.bits,ye){e.msg=\"invalid distances set\",i.mode=ce;break}if(i.mode=ie,t===A)break e;case ie:i.mode=ne;case ne:if(f>=6&&l>=258){e.next_out=s,e.avail_out=l,e.next_in=o,e.avail_in=f,i.hold=c,i.bits=h,p(e,w),s=e.next_out,r=e.output,l=e.avail_out,o=e.next_in,a=e.input,f=e.avail_in,c=i.hold,h=i.bits,i.mode===X&&(i.back=-1);break}for(i.back=0;Be=i.lencode[c&(1<<i.lenbits)-1],me=Be>>>24,ke=Be>>>16&255,_e=65535&Be,!(me<=h);){if(0===f)break e;f--,c+=a[o++]<<h,h+=8}if(ke&&0===(240&ke)){for(ge=me,ve=ke,pe=_e;Be=i.lencode[pe+((c&(1<<ge+ve)-1)>>ge)],me=Be>>>24,ke=Be>>>16&255,_e=65535&Be,!(ge+me<=h);){if(0===f)break e;f--,c+=a[o++]<<h,h+=8}c>>>=ge,h-=ge,i.back+=ge}if(c>>>=me,h-=me,i.back+=me,i.length=_e,0===ke){i.mode=fe;break}if(32&ke){i.back=-1,i.mode=X;break}if(64&ke){e.msg=\"invalid literal/length code\",i.mode=ce;break}i.extra=15&ke,i.mode=ae;case ae:if(i.extra){for(Ee=i.extra;h<Ee;){if(0===f)break e;f--,c+=a[o++]<<h,h+=8}i.length+=c&(1<<i.extra)-1,c>>>=i.extra,h-=i.extra,i.back+=i.extra}i.was=i.length,i.mode=re;case re:for(;Be=i.distcode[c&(1<<i.distbits)-1],me=Be>>>24,ke=Be>>>16&255,_e=65535&Be,!(me<=h);){if(0===f)break e;f--,c+=a[o++]<<h,h+=8}if(0===(240&ke)){for(ge=me,ve=ke,pe=_e;Be=i.distcode[pe+((c&(1<<ge+ve)-1)>>ge)],me=Be>>>24,ke=Be>>>16&255,_e=65535&Be,!(ge+me<=h);){if(0===f)break e;f--,c+=a[o++]<<h,h+=8}c>>>=ge,h-=ge,i.back+=ge}if(c>>>=me,h-=me,i.back+=me,64&ke){e.msg=\"invalid distance code\",i.mode=ce;break}i.offset=_e,i.extra=15&ke,i.mode=oe;case oe:if(i.extra){for(Ee=i.extra;h<Ee;){if(0===f)break e;f--,c+=a[o++]<<h,h+=8}i.offset+=c&(1<<i.extra)-1,c>>>=i.extra,h-=i.extra,i.back+=i.extra}if(i.offset>i.dmax){e.msg=\"invalid distance too far back\",i.mode=ce;break}i.mode=se;case se:if(0===l)break e;if(m=w-l,i.offset>m){if(m=i.offset-m,m>i.whave&&i.sane){e.msg=\"invalid distance too far back\",i.mode=ce;break}m>i.wnext?(m-=i.wnext,k=i.wsize-m):k=i.wnext-m,m>i.length&&(m=i.length),we=i.window}else we=r,k=s-i.offset,m=i.length;m>l&&(m=l),l-=m,i.length-=m;do r[s++]=we[k++];while(--m);0===i.length&&(i.mode=ne);break;case fe:if(0===l)break e;r[s++]=i.length,l--,i.mode=ne;break;case le:if(i.wrap){for(;h<32;){if(0===f)break e;f--,c|=a[o++]<<h,h+=8}if(w-=l,e.total_out+=w,i.total+=w,w&&(e.adler=i.check=i.flags?v(i.check,r,w,s-w):g(i.check,r,w,s-w)),w=l,(i.flags?c:n(c))!==i.check){e.msg=\"incorrect data check\",i.mode=ce;break}c=0,h=0}i.mode=de;case de:if(i.wrap&&i.flags){for(;h<32;){if(0===f)break e;f--,c+=a[o++]<<h,h+=8}if(c!==(4294967295&i.total)){e.msg=\"incorrect length check\",i.mode=ce;break}c=0,h=0}i.mode=ue;case ue:ye=R;break e;case ce:ye=O;break e;case he:return I;case be:default:return C}return e.next_out=s,e.avail_out=l,e.next_in=o,e.avail_in=f,i.hold=c,i.bits=h,(i.wsize||w!==e.avail_out&&i.mode<ce&&(i.mode<le||t!==B))&&u(e,e.output,e.next_out,w-e.avail_out)?(i.mode=he,I):(b-=e.avail_in,w-=e.avail_out,e.total_in+=b,e.total_out+=w,i.total+=w,i.wrap&&w&&(e.adler=i.check=i.flags?v(i.check,r,w,e.next_out-w):g(i.check,r,w,e.next_out-w)),e.data_type=i.bits+(i.last?64:0)+(i.mode===X?128:0)+(i.mode===ie||i.mode===Q?256:0),(0===b&&0===w||t===B)&&ye===z&&(ye=T),ye)}function h(e){if(!e||!e.state)return C;var t=e.state;return t.window&&(t.window=null),e.state=null,z}function b(e,t){var i;return e&&e.state?(i=e.state,0===(2&i.wrap)?C:(i.head=t,t.done=!1,z)):C}function w(e,t){var i,n,a,r=t.length;return e&&e.state?(i=e.state,0!==i.wrap&&i.mode!==G?C:i.mode===G&&(n=1,n=g(n,t,r,0),n!==i.check)?O:(a=u(e,t,r,r))?(i.mode=he,I):(i.havedict=1,z)):C}var m,k,_=e(\"../utils/common\"),g=e(\"./adler32\"),v=e(\"./crc32\"),p=e(\"./inffast\"),x=e(\"./inftrees\"),y=0,S=1,E=2,B=4,Z=5,A=6,z=0,R=1,N=2,C=-2,O=-3,I=-4,T=-5,U=8,D=1,F=2,L=3,H=4,M=5,j=6,K=7,P=8,Y=9,q=10,G=11,X=12,W=13,J=14,Q=15,V=16,$=17,ee=18,te=19,ie=20,ne=21,ae=22,re=23,oe=24,se=25,fe=26,le=27,de=28,ue=29,ce=30,he=31,be=32,we=852,me=592,ke=15,_e=ke,ge=!0;i.inflateReset=o,i.inflateReset2=s,i.inflateResetKeep=r,i.inflateInit=l,i.inflateInit2=f,i.inflate=c,i.inflateEnd=h,i.inflateGetHeader=b,i.inflateSetDictionary=w,i.inflateInfo=\"pako inflate (from Nodeca project)\"},{\"../utils/common\":1,\"./adler32\":3,\"./crc32\":5,\"./inffast\":7,\"./inftrees\":9}],9:[function(e,t,i){\"use strict\";var n=e(\"../utils/common\"),a=15,r=852,o=592,s=0,f=1,l=2,d=[3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258,0,0],u=[16,16,16,16,16,16,16,16,17,17,17,17,18,18,18,18,19,19,19,19,20,20,20,20,21,21,21,21,16,72,78],c=[1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577,0,0],h=[16,16,16,16,17,17,18,18,19,19,20,20,21,21,22,22,23,23,24,24,25,25,26,26,27,27,28,28,29,29,64,64];t.exports=function(e,t,i,b,w,m,k,_){var g,v,p,x,y,S,E,B,Z,A=_.bits,z=0,R=0,N=0,C=0,O=0,I=0,T=0,U=0,D=0,F=0,L=null,H=0,M=new n.Buf16(a+1),j=new n.Buf16(a+1),K=null,P=0;for(z=0;z<=a;z++)M[z]=0;for(R=0;R<b;R++)M[t[i+R]]++;for(O=A,C=a;C>=1&&0===M[C];C--);if(O>C&&(O=C),0===C)return w[m++]=20971520,w[m++]=20971520,_.bits=1,0;for(N=1;N<C&&0===M[N];N++);for(O<N&&(O=N),U=1,z=1;z<=a;z++)if(U<<=1,U-=M[z],U<0)return-1;if(U>0&&(e===s||1!==C))return-1;for(j[1]=0,z=1;z<a;z++)j[z+1]=j[z]+M[z];for(R=0;R<b;R++)0!==t[i+R]&&(k[j[t[i+R]]++]=R);if(e===s?(L=K=k,S=19):e===f?(L=d,H-=257,K=u,P-=257,S=256):(L=c,K=h,S=-1),F=0,R=0,z=N,y=m,I=O,T=0,p=-1,D=1<<O,x=D-1,e===f&&D>r||e===l&&D>o)return 1;for(var Y=0;;){Y++,E=z-T,k[R]<S?(B=0,Z=k[R]):k[R]>S?(B=K[P+k[R]],Z=L[H+k[R]]):(B=96,Z=0),g=1<<z-T,v=1<<I,N=v;do v-=g,w[y+(F>>T)+v]=E<<24|B<<16|Z|0;while(0!==v);for(g=1<<z-1;F&g;)g>>=1;if(0!==g?(F&=g-1,F+=g):F=0,R++,0===--M[z]){if(z===C)break;z=t[i+k[R]]}if(z>O&&(F&x)!==p){for(0===T&&(T=O),y+=N,I=z-T,U=1<<I;I+T<C&&(U-=M[I+T],!(U<=0));)I++,U<<=1;if(D+=1<<I,e===f&&D>r||e===l&&D>o)return 1;p=F&x,w[p]=O<<24|I<<16|y-m|0}}return 0!==F&&(w[y+F]=z-T<<24|64<<16|0),_.bits=O,0}},{\"../utils/common\":1}],10:[function(e,t,i){\"use strict\";t.exports={2:\"need dictionary\",1:\"stream end\",0:\"\",\"-1\":\"file error\",\"-2\":\"stream error\",\"-3\":\"data error\",\"-4\":\"insufficient memory\",\"-5\":\"buffer error\",\"-6\":\"incompatible version\"}},{}],11:[function(e,t,i){\"use strict\";function n(){this.input=null,this.next_in=0,this.avail_in=0,this.total_in=0,this.output=null,this.next_out=0,this.avail_out=0,this.total_out=0,this.msg=\"\",this.state=null,this.data_type=2,this.adler=0}t.exports=n},{}],\"/lib/inflate.js\":[function(e,t,i){\"use strict\";function n(e){if(!(this instanceof n))return new n(e);this.options=s.assign({chunkSize:16384,windowBits:0,to:\"\"},e||{});var t=this.options;t.raw&&t.windowBits>=0&&t.windowBits<16&&(t.windowBits=-t.windowBits,0===t.windowBits&&(t.windowBits=-15)),!(t.windowBits>=0&&t.windowBits<16)||e&&e.windowBits||(t.windowBits+=32),t.windowBits>15&&t.windowBits<48&&0===(15&t.windowBits)&&(t.windowBits|=15),this.err=0,this.msg=\"\",this.ended=!1,this.chunks=[],this.strm=new u,this.strm.avail_out=0;var i=o.inflateInit2(this.strm,t.windowBits);if(i!==l.Z_OK)throw new Error(d[i]);this.header=new c,o.inflateGetHeader(this.strm,this.header)}function a(e,t){var i=new n(t);if(i.push(e,!0),i.err)throw i.msg;return i.result}function r(e,t){return t=t||{},t.raw=!0,a(e,t)}var o=e(\"./zlib/inflate\"),s=e(\"./utils/common\"),f=e(\"./utils/strings\"),l=e(\"./zlib/constants\"),d=e(\"./zlib/messages\"),u=e(\"./zlib/zstream\"),c=e(\"./zlib/gzheader\"),h=Object.prototype.toString;n.prototype.push=function(e,t){var i,n,a,r,d,u,c=this.strm,b=this.options.chunkSize,w=this.options.dictionary,m=!1;if(this.ended)return!1;n=t===~~t?t:t===!0?l.Z_FINISH:l.Z_NO_FLUSH,\"string\"==typeof e?c.input=f.binstring2buf(e):\"[object ArrayBuffer]\"===h.call(e)?c.input=new Uint8Array(e):c.input=e,c.next_in=0,c.avail_in=c.input.length;do{if(0===c.avail_out&&(c.output=new s.Buf8(b),c.next_out=0,c.avail_out=b),i=o.inflate(c,l.Z_NO_FLUSH),i===l.Z_NEED_DICT&&w&&(u=\"string\"==typeof w?f.string2buf(w):\"[object ArrayBuffer]\"===h.call(w)?new Uint8Array(w):w,i=o.inflateSetDictionary(this.strm,u)),i===l.Z_BUF_ERROR&&m===!0&&(i=l.Z_OK,m=!1),i!==l.Z_STREAM_END&&i!==l.Z_OK)return this.onEnd(i),this.ended=!0,!1;c.next_out&&(0!==c.avail_out&&i!==l.Z_STREAM_END&&(0!==c.avail_in||n!==l.Z_FINISH&&n!==l.Z_SYNC_FLUSH)||(\"string\"===this.options.to?(a=f.utf8border(c.output,c.next_out),r=c.next_out-a,d=f.buf2string(c.output,a),c.next_out=r,c.avail_out=b-r,r&&s.arraySet(c.output,c.output,a,r,0),this.onData(d)):this.onData(s.shrinkBuf(c.output,c.next_out)))),0===c.avail_in&&0===c.avail_out&&(m=!0)}while((c.avail_in>0||0===c.avail_out)&&i!==l.Z_STREAM_END);return i===l.Z_STREAM_END&&(n=l.Z_FINISH),n===l.Z_FINISH?(i=o.inflateEnd(this.strm),this.onEnd(i),this.ended=!0,i===l.Z_OK):n!==l.Z_SYNC_FLUSH||(this.onEnd(l.Z_OK),c.avail_out=0,!0)},n.prototype.onData=function(e){this.chunks.push(e)},n.prototype.onEnd=function(e){e===l.Z_OK&&(\"string\"===this.options.to?this.result=this.chunks.join(\"\"):this.result=s.flattenChunks(this.chunks)),this.chunks=[],this.err=e,this.msg=this.strm.msg},i.Inflate=n,i.inflate=a,i.inflateRaw=r,i.ungzip=a},{\"./utils/common\":1,\"./utils/strings\":2,\"./zlib/constants\":4,\"./zlib/gzheader\":6,\"./zlib/inflate\":8,\"./zlib/messages\":10,\"./zlib/zstream\":11}]},{},[])(\"/lib/inflate.js\")});\n</script>\n<script src=\"faview.js\"></script>";
    }
    tileder.getViewer = getViewer;
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
    var Base64 = (function () {
        function Base64() {
        }
        Base64.encode = function (input) {
            var bytes = new Uint8Array(input);
            var byteLength = bytes.byteLength;
            var byteRemainder = byteLength % 3;
            var mainLength = byteLength - byteRemainder;
            var table = Base64.table;
            var base64 = new Uint8Array(mainLength / 3 * 4 + (byteRemainder ? 4 : 0));
            var chunk;
            // Main loop deals with bytes in chunks of 3
            var p = -1;
            for (var i = 0; i < mainLength; i = i + 3) {
                // Combine the three bytes into a single integer
                chunk = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
                // Use bitmasks to extract 6-bit segments from the triplet
                // and convert the raw binary segments to the appropriate ASCII encoding
                base64[++p] = table[(chunk & 16515072) >> 18]; // 16515072 = (2^6 - 1) << 18
                base64[++p] = table[(chunk & 258048) >> 12]; // 258048   = (2^6 - 1) << 12
                base64[++p] = table[(chunk & 4032) >> 6]; // 4032     = (2^6 - 1) << 6
                base64[++p] = table[chunk & 63]; // 63       = 2^6 - 1
            }
            // Deal with the remaining bytes and padding
            if (byteRemainder === 1) {
                chunk = bytes[mainLength];
                base64[++p] = table[(chunk & 252) >> 2]; // 252 = (2^6 - 1) << 2
                base64[++p] = table[(chunk & 3) << 4]; // 3   = 2^2 - 1
                base64[++p] = 0x3d;
                base64[++p] = 0x3d;
            }
            else if (byteRemainder === 2) {
                chunk = (bytes[mainLength] << 8) | bytes[mainLength + 1];
                base64[++p] = table[(chunk & 64512) >> 10]; // 64512 = (2^6 - 1) << 10
                base64[++p] = table[(chunk & 1008) >> 4]; // 1008  = (2^6 - 1) << 4
                base64[++p] = table[(chunk & 15) << 2]; // 15    = 2^4 - 1
                base64[++p] = 0x3d;
            }
            return base64.buffer;
        };
        // Based on https://gist.github.com/jonleighton/958841
        Base64.table = new Uint8Array([
            // A-Z
            0x41, 0x42, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48,
            0x49, 0x4a, 0x4b, 0x4c, 0x4d, 0x4e, 0x4f, 0x50,
            0x51, 0x52, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59, 0x5a,
            // a-z
            0x61, 0x62, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68,
            0x69, 0x6a, 0x6b, 0x6c, 0x6d, 0x6e, 0x6f, 0x70,
            0x71, 0x72, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7a,
            // 0-9
            0x30, 0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39,
            // + /
            0x2b, 0x2f
        ]);
        return Base64;
    }());
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
    function workerMain(global) {
        var tw = new TilederWorker(global);
        onmessage = function (e) { return tw.onMessage(e); };
    }
    tileder.workerMain = workerMain;
})(tileder || (tileder = {}));
if ('importScripts' in this) {
    importScripts('https://cdnjs.cloudflare.com/ajax/libs/pako/1.0.3/pako_deflate.min.js');
    tileder.workerMain(this);
}
