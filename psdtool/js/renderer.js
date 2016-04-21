'use strict';
var Renderer;
(function (Renderer_1) {
    (function (FlipType) {
        FlipType[FlipType["NoFlip"] = 0] = "NoFlip";
        FlipType[FlipType["FlipX"] = 1] = "FlipX";
        FlipType[FlipType["FlipY"] = 2] = "FlipY";
        FlipType[FlipType["FlipXY"] = 3] = "FlipXY";
    })(Renderer_1.FlipType || (Renderer_1.FlipType = {}));
    var FlipType = Renderer_1.FlipType;
    var Node = (function () {
        function Node(layer, parent) {
            var _this = this;
            this.layer = layer;
            this.parent = parent;
            this.getVisibleState = function () { return _this.layer.Visible; };
            this.state = '';
            this.nextState = '';
            this.children = [];
            if (!layer) {
                this.id = -1;
                return;
            }
            this.id = layer.SeqID;
            var w = layer.Width, h = layer.Height;
            if (w * h <= 0) {
                return;
            }
            this.buffer = document.createElement('canvas');
            this.buffer.width = w;
            this.buffer.height = h;
        }
        Object.defineProperty(Node.prototype, "visible", {
            get: function () { return this.getVisibleState(); },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Node.prototype, "stateHash", {
            get: function () { return Node.calcHash(this.state).toString(16); },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Node.prototype, "nextStateHash", {
            get: function () { return Node.calcHash(this.nextState).toString(16); },
            enumerable: true,
            configurable: true
        });
        // http://stackoverflow.com/a/7616484
        Node.calcHash = function (s) {
            if (s.length === 0) {
                return 0;
            }
            var hash = 0, chr;
            for (var i = 0; i < s.length; ++i) {
                chr = s.charCodeAt(i);
                hash = ((hash << 5) - hash) + chr;
                hash |= 0; // Convert to 32bit integer
            }
            return hash;
        };
        return Node;
    }());
    Renderer_1.Node = Node;
    var Renderer = (function () {
        function Renderer(psd) {
            this.psd = psd;
            this.canvas = document.createElement('canvas');
            this.root = new Node(null, null);
            this.nodes = {};
            this.buildTree(this.root, psd);
            this.root.buffer = document.createElement('canvas');
            this.root.buffer.width = psd.Width;
            this.root.buffer.height = psd.Height;
            this.registerClippingGroup(this.root);
        }
        Renderer.prototype.draw = function (ctx, src, x, y, opacity, blendMode) {
            switch (blendMode) {
                case 'source-over':
                case 'destination-in':
                case 'destination-out':
                    ctx.globalAlpha = opacity;
                    ctx.globalCompositeOperation = blendMode;
                    ctx.drawImage(src, x, y);
                    return;
            }
            blend(ctx.canvas, src, x, y, src.width, src.height, opacity, blendMode);
            return;
        };
        Renderer.prototype.clear = function (ctx) {
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = 'source-over';
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        };
        Object.defineProperty(Renderer.prototype, "Width", {
            get: function () { return this.psd.Width; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Renderer.prototype, "Height", {
            get: function () { return this.psd.Height; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Renderer.prototype, "CanvasWidth", {
            get: function () { return this.psd.CanvasWidth; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Renderer.prototype, "CanvasHeight", {
            get: function () { return this.psd.CanvasHeight; },
            enumerable: true,
            configurable: true
        });
        Renderer.prototype.buildTree = function (n, layer) {
            var nc;
            for (var _i = 0, _a = layer.Children; _i < _a.length; _i++) {
                var lc = _a[_i];
                nc = new Node(lc, n);
                this.buildTree(nc, lc);
                n.children.push(nc);
                this.nodes[nc.id] = nc;
            }
        };
        Renderer.prototype.registerClippingGroup = function (n) {
            var clip = [];
            for (var nc = void 0, i = n.children.length - 1; i >= 0; --i) {
                nc = n.children[i];
                this.registerClippingGroup(nc);
                if (nc.layer.Clipping) {
                    clip.unshift(nc);
                }
                else {
                    if (clip.length) {
                        for (var _i = 0, clip_1 = clip; _i < clip_1.length; _i++) {
                            var c = clip_1[_i];
                            c.clippedBy = nc;
                        }
                        nc.clippingBuffer = document.createElement('canvas');
                        nc.clippingBuffer.width = nc.layer.Width;
                        nc.clippingBuffer.height = nc.layer.Height;
                        nc.clip = clip;
                    }
                    clip = [];
                }
            }
        };
        Renderer.prototype.render = function (scale, autoTrim, flip, callback) {
            var _this = this;
            var s = Date.now();
            this.root.nextState = '';
            for (var _i = 0, _a = this.root.children; _i < _a.length; _i++) {
                var cn = _a[_i];
                if (!cn.layer.Clipping) {
                    if (this.calculateNextState(cn, cn.layer.Opacity / 255, cn.layer.BlendMode)) {
                        this.root.nextState += cn.nextStateHash + '+';
                    }
                }
            }
            var bb = this.root.buffer;
            if (this.root.state !== this.root.nextState) {
                var bbctx = bb.getContext('2d');
                this.clear(bbctx);
                for (var _b = 0, _c = this.root.children; _b < _c.length; _b++) {
                    var cn = _c[_b];
                    if (!cn.layer.Clipping) {
                        this.drawLayer(bbctx, cn, -this.psd.X, -this.psd.Y, cn.layer.Opacity / 255, cn.layer.BlendMode);
                    }
                }
                this.root.state = this.root.nextState;
            }
            console.log('rendering: ' + (Date.now() - s));
            s = Date.now();
            this.downScale(bb, scale, function (progress, c) {
                console.log('scaling: ' + (Date.now() - s) + '(phase:' + progress + ')');
                var w = autoTrim ? _this.psd.Width : _this.psd.CanvasWidth;
                var h = autoTrim ? _this.psd.Height : _this.psd.CanvasHeight;
                var canvas = _this.canvas;
                canvas.width = 0 | w * scale;
                canvas.height = 0 | h * scale;
                var ctx = canvas.getContext('2d');
                _this.clear(ctx);
                ctx.save();
                switch (flip) {
                    case 1 /* FlipX */:
                        ctx.translate(canvas.width, 0);
                        ctx.scale(-1, 1);
                        break;
                    case 2 /* FlipY */:
                        ctx.translate(0, canvas.height);
                        ctx.scale(1, -1);
                        break;
                    case 3 /* FlipXY */:
                        ctx.translate(canvas.width, canvas.height);
                        ctx.scale(-1, -1);
                        break;
                }
                ctx.drawImage(c, autoTrim ? 0 : 0 | _this.psd.X * scale, autoTrim ? 0 : 0 | _this.psd.Y * scale);
                ctx.restore();
                callback(progress, canvas);
            });
        };
        Renderer.prototype.downScale = function (src, scale, callback) {
            if (scale === 1) {
                callback(1, src);
                return;
            }
            var ds = new DownScaler(src, scale);
            callback(0, ds.fast());
            setTimeout(function () { return ds.beautifulWorker(function (canvas) { return callback(1, canvas); }); }, 0);
        };
        Renderer.prototype.calculateNextState = function (n, opacity, blendMode) {
            if (!n.visible || opacity === 0) {
                return false;
            }
            n.nextState = '';
            if (n.layer.Children.length) {
                if (blendMode === 'pass-through') {
                    n.nextState += n.parent.nextStateHash + '+';
                }
                for (var i = 0, child = void 0; i < n.layer.Children.length; ++i) {
                    child = n.layer.Children[i];
                    if (!child.Clipping) {
                        if (this.calculateNextState(n.children[i], child.Opacity / 255, child.BlendMode)) {
                            n.nextState += n.children[i].nextStateHash + '+';
                        }
                    }
                }
            }
            else if (n.layer.Canvas) {
                n.nextState = n.id.toString();
            }
            if (n.layer.Mask) {
                n.nextState += '|lm';
            }
            if (!n.clip) {
                return true;
            }
            n.nextState += '|cm' + (n.layer.BlendClippedElements ? '1' : '0') + ':';
            if (n.layer.BlendClippedElements) {
                for (var i = 0, cn = void 0; i < n.clip.length; ++i) {
                    cn = n.clip[i];
                    if (this.calculateNextState(n.clip[i], cn.layer.Opacity / 255, cn.layer.BlendMode)) {
                        n.nextState += n.clip[i].nextStateHash + '+';
                    }
                }
                return true;
            }
            // we cannot cache in this mode
            n.nextState += Date.now() + '_' + Math.random() + ':';
            for (var _i = 0, _a = n.clip; _i < _a.length; _i++) {
                var cn = _a[_i];
                if (this.calculateNextState(cn, 1, 'source-over')) {
                    n.nextState += cn.nextStateHash + '+';
                }
            }
            return true;
        };
        Renderer.prototype.drawLayer = function (ctx, n, x, y, opacity, blendMode) {
            if (!n.visible || opacity === 0 || (!n.children.length && !n.layer.Canvas)) {
                return false;
            }
            var bb = n.buffer;
            if (n.state === n.nextState) {
                if (blendMode === 'pass-through') {
                    blendMode = 'source-over';
                }
                this.draw(ctx, bb, x + n.layer.X, y + n.layer.Y, opacity, blendMode);
                return true;
            }
            var bbctx = bb.getContext('2d');
            this.clear(bbctx);
            if (n.children.length) {
                if (blendMode === 'pass-through') {
                    this.draw(bbctx, n.parent.buffer, -x - n.layer.X, -y - n.layer.Y, 1, 'source-over');
                    blendMode = 'source-over';
                }
                for (var _i = 0, _a = n.children; _i < _a.length; _i++) {
                    var cn = _a[_i];
                    if (!cn.layer.Clipping) {
                        this.drawLayer(bbctx, cn, -n.layer.X, -n.layer.Y, cn.layer.Opacity / 255, cn.layer.BlendMode);
                    }
                }
            }
            else if (n.layer.Canvas) {
                this.draw(bbctx, n.layer.Canvas, 0, 0, 1, 'source-over');
            }
            if (n.layer.Mask) {
                this.draw(bbctx, n.layer.Mask, n.layer.MaskX - n.layer.X, n.layer.MaskY - n.layer.Y, 1, n.layer.MaskDefaultColor ? 'destination-out' : 'destination-in');
            }
            if (!n.clip) {
                this.draw(ctx, bb, x + n.layer.X, y + n.layer.Y, opacity, blendMode);
                n.state = n.nextState;
                return true;
            }
            var cbb = n.clippingBuffer;
            var cbbctx = cbb.getContext('2d');
            if (n.layer.BlendClippedElements) {
                this.clear(cbbctx);
                this.draw(cbbctx, bb, 0, 0, 1, 'source-over');
                var changed = false;
                for (var _b = 0, _c = n.clip; _b < _c.length; _b++) {
                    var cn = _c[_b];
                    changed = this.drawLayer(cbbctx, cn, -n.layer.X, -n.layer.Y, cn.layer.Opacity / 255, cn.layer.BlendMode) || changed;
                }
                if (changed) {
                    this.draw(cbbctx, bb, 0, 0, 1, 'destination-in');
                }
                // swap buffer for next time
                n.clippingBuffer = bb;
                n.buffer = cbb;
                this.draw(ctx, cbb, x + n.layer.X, y + n.layer.Y, opacity, blendMode);
                n.state = n.nextState;
                return true;
            }
            // this is minor code path.
            // it is only used when "Blend Clipped Layers as Group" is unchecked in Photoshop's Layer Style dialog.
            this.draw(ctx, bb, x + n.layer.X, y + n.layer.Y, opacity, blendMode);
            this.clear(cbbctx);
            for (var _d = 0, _e = n.clip; _d < _e.length; _d++) {
                var cn = _e[_d];
                if (!this.drawLayer(cbbctx, cn, -n.layer.X, -n.layer.Y, 1, 'source-over')) {
                    continue;
                }
                this.draw(cbbctx, bb, 0, 0, 1, 'destination-in');
                this.draw(ctx, cbb, x + n.layer.X, y + n.layer.Y, cn.layer.Opacity / 255, cn.layer.BlendMode);
                this.clear(cbbctx);
            }
            n.state = n.nextState;
            return true;
        };
        return Renderer;
    }());
    Renderer_1.Renderer = Renderer;
})(Renderer || (Renderer = {}));
