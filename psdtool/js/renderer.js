/// <reference path="psd/psd.d.ts" />
/// <reference path="blend/blend.d.ts" />
'use strict';
var StateNode = (function () {
    function StateNode(layer, parent) {
        var _this = this;
        this.layer = layer;
        this.parent = parent;
        this.getVisibleState = function () { return _this.layer.Visible; };
        this.setVisibleState = function (v) { return undefined; };
        this.state = '';
        this.nextState = '';
        this.children = [];
        if (!layer) {
            this.id = 'r';
            return;
        }
        this.id = 'l' + layer.SeqID;
        var w = layer.Width, h = layer.Height;
        if (w * h <= 0) {
            return;
        }
        this.buffer = document.createElement('canvas');
        this.buffer.width = w;
        this.buffer.height = h;
    }
    Object.defineProperty(StateNode.prototype, "visible", {
        get: function () { return this.getVisibleState(); },
        set: function (v) { this.setVisibleState(v); },
        enumerable: true,
        configurable: true
    });
    return StateNode;
}());
var Renderer = (function () {
    function Renderer(psd) {
        this.psd = psd;
        this.canvas = document.createElement('canvas');
        this.StateTreeRoot = new StateNode(null, null);
        this.buildStateTree(this.StateTreeRoot, psd);
        this.StateTreeRoot.buffer = document.createElement('canvas');
        this.StateTreeRoot.buffer.width = psd.Width;
        this.StateTreeRoot.buffer.height = psd.Height;
        this.registerClippingGroup(this.StateTreeRoot);
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
    Renderer.prototype.buildStateTree = function (n, layer) {
        for (var nc = void 0, i = 0; i < layer.Children.length; ++i) {
            nc = new StateNode(layer.Children[i], n);
            this.buildStateTree(nc, layer.Children[i]);
            n.children.push(nc);
        }
    };
    Renderer.prototype.registerClippingGroup = function (n) {
        var clip = [];
        for (var nc = void 0, i = n.children.length - 1, j = 0; i >= 0; --i) {
            nc = n.children[i];
            this.registerClippingGroup(nc);
            if (nc.layer.Clipping) {
                clip.unshift(nc);
            }
            else {
                if (clip.length) {
                    for (j = 0; j < clip.length; ++j) {
                        clip[j].clippedBy = nc;
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
    Renderer.prototype.render = function (scale, autoTrim, mirror, callback) {
        var _this = this;
        var s = Date.now();
        this.StateTreeRoot.nextState = '';
        for (var cn = void 0, i = 0; i < this.StateTreeRoot.children.length; ++i) {
            cn = this.StateTreeRoot.children[i];
            if (!cn.layer.Clipping) {
                if (this.calculateNextState(cn, cn.layer.Opacity / 255, cn.layer.BlendMode)) {
                    this.StateTreeRoot.nextState += cn.nextState + '+';
                }
            }
        }
        var bb = this.StateTreeRoot.buffer;
        if (this.StateTreeRoot.state !== this.StateTreeRoot.nextState) {
            var bbctx = bb.getContext('2d');
            this.clear(bbctx);
            for (var cn = void 0, i = 0; i < this.StateTreeRoot.children.length; ++i) {
                cn = this.StateTreeRoot.children[i];
                if (!cn.layer.Clipping) {
                    this.drawLayer(bbctx, cn, -this.psd.X, -this.psd.Y, cn.layer.Opacity / 255, cn.layer.BlendMode);
                }
            }
            this.StateTreeRoot.state = this.StateTreeRoot.nextState;
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
            if (mirror) {
                ctx.translate(canvas.width, 0);
                ctx.scale(-1, 1);
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
        setTimeout(function () {
            ds.beautifulWorker(function (canvas) {
                callback(1, canvas);
            });
        }, 0);
    };
    Renderer.prototype.calculateNextState = function (n, opacity, blendMode) {
        if (!n.visible || opacity === 0) {
            return false;
        }
        n.nextState = '';
        if (n.layer.Children.length) {
            if (blendMode === 'pass-through') {
                n.nextState += n.parent.nextState + '+';
            }
            for (var i = 0, child = void 0; i < n.layer.Children.length; ++i) {
                child = n.layer.Children[i];
                if (!child.Clipping) {
                    if (this.calculateNextState(n.children[i], child.Opacity / 255, child.BlendMode)) {
                        n.nextState += n.children[i].nextState + '+';
                    }
                }
            }
        }
        else if (n.layer.Canvas) {
            n.nextState = n.id;
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
                    n.nextState += n.clip[i].nextState + '+';
                }
            }
            return true;
        }
        // we cannot cache in this mode
        n.nextState += Date.now() + '_' + Math.random() + ':';
        for (var i = 0, cn = void 0; i < n.clip.length; ++i) {
            cn = n.clip[i];
            if (this.calculateNextState(cn, 1, 'source-over')) {
                n.nextState += cn.nextState + '+';
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
            for (var i = 0, cn = void 0; i < n.children.length; ++i) {
                cn = n.children[i];
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
            for (var i = 0, cn = void 0; i < n.clip.length; ++i) {
                cn = n.clip[i];
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
        for (var i = 0, cn = void 0; i < n.clip.length; ++i) {
            cn = n.clip[i];
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
