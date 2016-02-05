(function() {
   'use strict';

   function init() {
      var dz = document.getElementById('dropzone');
      dz.addEventListener('dragenter', function(e) {
         this.classList.add('psdtool-drop-active');
         e.preventDefault();
         e.stopPropagation();
         return false;
      }, false);
      dz.addEventListener('dragover', function(e) {
         this.classList.add('psdtool-drop-active');
         e.preventDefault();
         e.stopPropagation();
         return false;
      }, false);
      dz.addEventListener('dragleave', function(e) {
         this.classList.remove('psdtool-drop-active');
         e.preventDefault();
         e.stopPropagation();
         return false;
      }, false);
      dz.addEventListener('drop', function(e) {
         this.classList.remove('psdtool-drop-active');
         if (e.dataTransfer.files.length > 0) {
            loadAndParse(e.dataTransfer.files[0]);
         }
         e.preventDefault();
         e.stopPropagation();
         return false;
      }, false);
      document.getElementById('inputfile').addEventListener('change', function(e) {
         loadAndParse(document.getElementById('inputfile').files[0]);
      }, false);
      document.getElementById('samplefile').addEventListener('click', function(e) {
         loadAndParse(document.getElementById('samplefile').getAttribute('data-filename'));
      }, false);
      window.addEventListener('resize', resized, false);
   }

   function resized() {
      var mainContainer = document.getElementById('main-container');
      var miscUi = document.getElementById('misc-ui');
      var previewContainer = document.getElementById('preview-container');
      previewContainer.style.width = mainContainer.clientWidth + 'px';
      previewContainer.style.height = (mainContainer.clientHeight - miscUi.offsetHeight) + 'px';
   }

   function loadAndParse(file_or_url) {
      var fileOpenUi = document.getElementById('file-open-ui');
      var manual = document.getElementById('manual');
      var fileLoadingUi = document.getElementById('file-loading-ui');
      var errorReportUi = document.getElementById('error-report-ui');
      var main = document.getElementById('main');
      var bar = document.getElementById('progress-bar');

      fileOpenUi.style.display = 'none';
      manual.style.display = 'none';
      fileLoadingUi.style.display = 'block';
      errorReportUi.style.display = 'none';
      main.style.display = 'none';

      var barCaptionContainer = bar.querySelector('.psdtool-progress-bar-caption');
      var barCaption = document.createTextNode('0% Complete');
      var captionContainer = document.getElementById('progress-caption');
      var caption = document.createTextNode('Now loading...');
      var errorMessageContainer = document.getElementById('error-message');
      var errorMessage = document.createTextNode('');

      removeAllChild(barCaptionContainer);
      barCaptionContainer.appendChild(barCaption);
      removeAllChild(captionContainer);
      captionContainer.appendChild(caption);
      removeAllChild(errorMessageContainer);
      errorMessageContainer.appendChild(errorMessage);

      function progress(step, progress, layer) {
         var p, msg, ptext;
         switch (step) {
            case 'receive':
               p = progress * 100;
               msg = 'Receiving file...';
               break;
            case 'parse':
               p = progress * 50;
               msg = 'Parsing psd file...';
               break;
            case 'draw':
               p = 50 + progress * 50;
               msg = 'Drawing "' + layer.Name + '" layer image...';
               break;
         }
         ptext = p.toFixed(0) + '%';
         bar.style.width = p + '%';
         bar.setAttribute('aria-valuenow', ptext);
         barCaption.textContent = ptext + ' Complete';
         caption.textContent = ptext + ' ' + msg;
      }

      loadAsArrayBuffer(progress, file_or_url)
         .then(parse.bind(this, progress))
         .then(initMain)
         .then(function() {
            fileLoadingUi.style.display = 'none';
            fileOpenUi.style.display = 'none';
            manual.style.display = 'none';
            errorReportUi.style.display = 'none';
            main.style.display = 'block';
            resized();
         }, function(e) {
            fileLoadingUi.style.display = 'none';
            fileOpenUi.style.display = 'block';
            manual.style.display = 'block';
            errorReportUi.style.display = 'block';
            main.style.display = 'none';
            errorMessage.textContent = e;
            console.error(e);
         });
   }

   function loadAsArrayBuffer(progress, file_or_url) {
      var deferred = m.deferred();
      if (typeof file_or_url == 'string') {
         if (location.protocol == 'https:' && file_or_url.substring(0, 5) == 'http:') {
            setTimeout(function() {
               deferred.reject(new Error('cannot access to the insecure content from HTTPS.'));
            }, 0);
            return deferred.promise;
         }
         if (file_or_url.substring(0, 3) == 'xd:') {
            file_or_url = file_or_url.substring(3);
            var ifr = document.createElement('iframe');
            ifr.sandbox = 'allow-scripts allow-same-origin';
            ifr.onload = function() {
               var msgCh = new MessageChannel();
               var port = msgCh.port1;
               port.onmessage = function(e) {
                  if (!e.data || !e.data.type) {
                     return;
                  }
                  switch (e.data.type) {
                     case 'complete':
                        document.body.removeChild(ifr);
                        progress('receive', 1);
                        deferred.resolve({
                           buffer: e.data.data,
                           name: e.data.name
                        });
                        return;
                     case 'error':
                        document.body.removeChild(ifr);
                        deferred.reject(new Error(e.data.message ? e.data.message : 'could not receive data'));
                        return;
                     case 'progress':
                        progress('receive', e.data.loaded / e.data.total);
                        return;
                  }
               };
               ifr.contentWindow.postMessage(
                  location.protocol,
                  file_or_url.replace(/^([^:]+:\/\/[^\/]+).*$/, '$1'), [msgCh.port2]
               );
            }
            ifr.src = file_or_url;
            ifr.style.display = 'none';
            document.body.appendChild(ifr);
            return deferred.promise;
         }
         var xhr = new XMLHttpRequest();
         xhr.open('GET', file_or_url);
         xhr.responseType = 'arraybuffer';
         xhr.onload = function(e) {
            progress('receive', 1);
            deferred.resolve({
               buffer: xhr.response,
               name: 'file'
            });
         };
         xhr.onerror = function(e) {
            deferred.reject(e);
         }
         xhr.onprogress = function(e) {
            progress('receive', e.loaded / e.total);
         };
         xhr.send(null);
         return deferred.promise;
      }
      var r = new FileReader();
      r.readAsArrayBuffer(file_or_url);
      r.onload = function(e) {
         deferred.resolve({
            buffer: r.result,
            name: file_or_url.name.replace(/\.psd$/ig, '') + '_'
         });
      };
      r.onerror = function(e) {
         deferred.reject(e);
      }
      return deferred.promise;
   }

   function saveCanvas(canvas, filename) {
      var b64 = canvas.toDataURL('image/png');
      var bin = atob(b64.substring(b64.indexOf(',') + 1));
      var buf = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; ++i) {
         buf[i] = bin.charCodeAt(i);
      }
      saveAs(new Blob([buf.buffer], {
         type: 'image/png'
      }), filename);
      return true;
   }

   function parse(progress, obj) {
      var deferred = m.deferred();
      parsePSD(obj.buffer, progress, function(root) {
         root.name = obj.name;
         deferred.resolve(root);
      }, function(e) {
         deferred.reject(e);
      });
      return deferred.promise;
   }

   function removeAllChild(elem) {
      for (var i = elem.childNodes.length - 1; i >= 0; --i) {
         elem.removeChild(elem.firstChild);
      }
   }

   function initMain(root) {
      var deferred = m.deferred();
      setTimeout(function() {
         try {
            registerClippingGroup(root.Child);

            var canvas = document.createElement('canvas');
            document.getElementById('preview-container').appendChild(canvas);
            var redraw = render.bind(null, canvas, root);
            var save = saveCanvas.bind(null, canvas);
            buildTree(root, redraw);
            buildMiscUI(root, redraw, save);
            render(canvas, root);
            deferred.resolve();
         } catch (e) {
            deferred.reject(e);
         }
      }, 1);
      return deferred.promise;
   }

   function draw(ctx, src, x, y, opacity, blendMode) {
      switch (blendMode) {
         case 'source-over':
         case 'destination-in':
         case 'destination-out':
            break;
         default:
            blend(ctx.canvas, src, x, y, src.width, src.height, opacity, blendMode);
            return;
      }
      ctx.globalAlpha = opacity;
      ctx.globalCompositeOperation = blendMode;
      ctx.drawImage(src, x, y);
   }

   function clear(ctx) {
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
   }

   function calculateNextState(layer, opacity, blendMode) {
      if (!layer.visibleInput.checked || opacity == 0) {
         return false;
      }

      layer.nextState = "";
      if (layer.Child.length) {
         if (blendMode == 'pass-through') {
            layer.nextState += layer.parentLayer.nextState + '+';
         }
         for (var i = 0, child; i < layer.Child.length; ++i) {
            child = layer.Child[i];
            if (!child.Clipping) {
               if (calculateNextState(child, child.Opacity / 255, child.BlendMode)) {
                  layer.nextState += child.nextState + '+';
               }
            }
         }
      } else if (layer.Canvas) {
         layer.nextState = layer.id;
      }

      if (layer.MaskCanvas) {
         layer.nextState += '|lm';
      }

      if (!layer.clip.length) {
         return true;
      }

      layer.nextState += '|cm' + (layer.BlendClippedElements ? '1' : '0') + ':';
      if (layer.BlendClippedElements) {
         for (var i = 0, child; i < layer.clip.length; ++i) {
            child = layer.clip[i];
            if (calculateNextState(child, child.Opacity / 255, child.BlendMode)) {
               layer.nextState += child.nextState + '+';
            }
         }
         return true;
      }

      // we cannot cache in this mode
      layer.nextState += Date.now() + '_' + Math.random() + ':';

      for (var i = 0, child; i < layer.clip.length; ++i) {
         child = layer.clip[i];
         if (calculateNextState(child, 1, 'source-over')) {
            layer.nextState += child.nextState + '+';
         }
      }
      return true;
   }

   function drawLayer(ctx, layer, x, y, opacity, blendMode) {
      if (!layer.visibleInput.checked || opacity == 0) {
         return false;
      }
      var bb = layer.Buffer;
      if (layer.currentState == layer.nextState) {
         draw(ctx, bb, x + layer.X, y + layer.Y, opacity, blendMode);
         return true;
      }

      var bbctx = bb.getContext('2d');

      clear(bbctx);
      if (layer.Child.length) {
         if (blendMode == 'pass-through') {
            draw(bbctx, layer.parentLayer.Buffer, -x - layer.X, -y - layer.Y, 1, 'source-over');
            blendMode = 'source-over';
         }
         for (var i = 0, child; i < layer.Child.length; ++i) {
            child = layer.Child[i];
            if (!child.Clipping) {
               drawLayer(bbctx, child, -layer.X, -layer.Y, child.Opacity / 255, child.BlendMode);
            }
         }
      } else if (layer.Canvas) {
         draw(bbctx, layer.Canvas, 0, 0, 1, 'source-over');
      }

      if (layer.MaskCanvas) {
         draw(
            bbctx,
            layer.MaskCanvas,
            layer.MaskX - layer.X,
            layer.MaskY - layer.Y,
            1,
            layer.MaskDefaultColor ? 'destination-out' : 'destination-in'
         );
      }

      if (!layer.clip.length) {
         draw(ctx, bb, x + layer.X, y + layer.Y, opacity, blendMode);
         layer.currentState = layer.nextState;
         return true;
      }

      var cbb = layer.ClippingBuffer;
      var cbbctx = cbb.getContext('2d');

      if (layer.BlendClippedElements) {
         clear(cbbctx);
         draw(cbbctx, bb, 0, 0, 1, 'source-over');
         var changed = false;
         for (var i = 0, child; i < layer.clip.length; ++i) {
            child = layer.clip[i];
            changed = drawLayer(
               cbbctx,
               child, -layer.X, -layer.Y,
               child.Opacity / 255,
               child.BlendMode
            ) || changed;
         }
         if (changed) {
            draw(cbbctx, bb, 0, 0, 1, 'destination-in');
         }
         // swap buffer for next time
         layer.ClippingBuffer = bb;
         layer.Buffer = cbb;
         draw(ctx, cbb, x + layer.X, y + layer.Y, opacity, blendMode);
         layer.currentState = layer.nextState;
         return true;
      }

      // this is minor code path.
      // it is only used when "Blend Clipped Layers as Group" is unchecked in Photoshop's Layer Style dialog.
      draw(ctx, bb, x + layer.X, y + layer.Y, opacity, blendMode);
      clear(cbbctx);
      for (var i = 0, child; i < layer.clip.length; ++i) {
         child = layer.clip[i];
         if (!drawLayer(cbbctx, child, -layer.X, -layer.Y, 1, 'source-over')) {
            continue;
         }
         draw(cbbctx, bb, 0, 0, 1, 'destination-in');
         draw(ctx, cbb, x + layer.X, y + layer.Y, child.Opacity / 255, child.BlendMode);
         clear(cbbctx);
      }
      layer.currentState = layer.nextState;
      return true;
   }

   function render(canvas, root) {
      var s = Date.now();

      root.nextState = "";
      for (var i = 0, layer; i < root.Child.length; ++i) {
         layer = root.Child[i];
         if (!layer.Clipping) {
            if (calculateNextState(layer, layer.Opacity / 255, layer.BlendMode)) {
               root.nextState += layer.nextState + '+';
            }
         }
      }

      var bb = root.Buffer;
      if (root.currentState != root.nextState) {
         var bbctx = bb.getContext('2d');
         clear(bbctx);
         for (var i = 0, layer; i < root.Child.length; ++i) {
            layer = root.Child[i];
            if (!layer.Clipping) {
               drawLayer(bbctx, layer, -root.RealX, -root.RealY, layer.Opacity / 255, layer.BlendMode);
            }
         }
         root.currentState = root.nextState;
      }
      console.log("rendering: " + (Date.now() - s));


      var scale = 1;
      var px = parseInt(root.maxPixels.value, 10);
      var w = root.Buffer.width;
      var h = root.Buffer.height;
      switch (root.fixedSide.value) {
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
         } else {
            scale = 1 / w;
         }
      }

      s = Date.now();
      canvas.width = 0 | root.Width * scale;
      canvas.height = 0 | root.Height * scale;
      root.seqDl.disabled = true;
      downScaleCanvas(root.Buffer, scale, function(phase, c) {
         console.log("scaling: " + (Date.now() - s) + '(phase:' + phase + ')');
         var ctx = canvas.getContext('2d');
         clear(ctx);
         ctx.save();
         if (root.invertInput.checked) {
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
         }
         ctx.drawImage(c, 0 | root.RealX * scale, 0 | root.RealY * scale);
         ctx.restore();
         root.seqDl.disabled = phase != 1;
      });
   }

   // this code is based on http://jsfiddle.net/gamealchemist/kpQyE/14/
   // changes are:
   //   added alpha-channel support
   //   avoid "optimized too many times" in chrome
   //   use web worker
   function downScaleCanvas(src, scale, callback) {
      if (scale == 1) {
         callback(1, src);
         return;
      }

      var sw = src.width,
         sh = src.height,
         dw = Math.floor(src.width * scale),
         dh = Math.floor(src.height * scale);

      var dest = document.createElement('canvas');
      dest.width = dw;
      dest.height = dh;
      var ctx = dest.getContext('2d');
      ctx.drawImage(src, 0, 0, sw, sh, 0, 0, dw, dh);
      callback(0, dest);

      var w = new Worker('js/resizer.js');
      w.onmessage = function(e) {
         var ctx = dest.getContext('2d');
         var imgData = ctx.createImageData(dw, dh);
         downScaleCanvasFinalize(
            imgData.data,
            new Uint8Array(e.data.buf),
            dw,
            dh,
            imgData.width
         );
         ctx.putImageData(imgData, 0, 0);
         callback(1, dest);
      };
      var sbuf = src.getContext('2d').getImageData(0, 0, sw, sh);
      w.postMessage({
         scale: scale,
         buf: sbuf.data.buffer,
         width: sbuf.width,
         height: sbuf.height
      }, [sbuf.data.buffer]);
   }

   function downScaleCanvasFinalize(d, s, w, h, dw) {
      w *= 4;
      dw *= 4;
      for (var y = 0, sl = 0, dl = 0; y < h; ++y) {
         sl = w * y;
         dl = dw * y;
         for (var x = 0; x < w; x += 4) {
            d[dl + x] = s[sl + x];
            d[dl + x + 1] = s[sl + x + 1];
            d[dl + x + 2] = s[sl + x + 2];
            d[dl + x + 3] = s[sl + x + 3];
         }
      }
   }

   function updateClass(root) {
      function r(layer) {
         if (layer.visibleInput.checked) {
            layer.li.classList.remove('psdtool-hidden');
            for (var i = 0; i < layer.clip.length; ++i) {
               layer.clip[i].li.classList.remove('psdtool-hidden-by-clipping');
            }
         } else {
            layer.li.classList.add('psdtool-hidden');
            for (var i = 0; i < layer.clip.length; ++i) {
               layer.clip[i].li.classList.add('psdtool-hidden-by-clipping');
            }
         }
         for (var i = 0; i < layer.Child.length; ++i) {
            r(layer.Child[i]);
         }
      }
      for (var i = 0; i < root.Child.length; ++i) {
         r(root.Child[i]);
      }
   }

   function registerClippingGroup(layers) {
      var clip = [];
      for (var i = layers.length - 1; i >= 0; --i) {
         var layer = layers[i];
         registerClippingGroup(layer.Child);
         if (layer.Clipping) {
            clip.unshift(layer);
            layer.clip = [];
         } else {
            if (clip.length) {
               for (var j = 0; j < clip.length; ++j) {
                  clip[j].clippedBy = layer;
               }
               layer.ClippingBuffer = document.createElement('canvas');
               layer.ClippingBuffer.width = layer.Buffer.width;
               layer.ClippingBuffer.height = layer.Buffer.height;
            }
            layer.clip = clip;
            clip = [];
         }
      }
   }

   function buildMiscUI(root, redraw, save) {
      root.invertInput = document.getElementById('invert-input');
      root.invertInput.addEventListener('click', function(e) {
         redraw();
      }, false)
      root.fixedSide = document.getElementById('fixed-side');
      root.fixedSide.addEventListener('change', function(e) {
         redraw();
      }, false)

      var lastPx;
      root.maxPixels = document.getElementById('max-pixels');
      root.maxPixels.value = root.Height;
      root.maxPixels.addEventListener('blur', function(e) {
         if (this.value == lastPx) {
            return;
         }
         lastPx = this.value;
         redraw();
      }, false);

      root.seqDlPrefix = document.getElementById('seq-dl-prefix');
      root.seqDlPrefix.value = root.name;

      root.seqDl = document.getElementById('seq-dl');
      root.seqDl.addEventListener('click', function(e) {
         var prefix = root.seqDlPrefix.value;
         var numElem = document.getElementById('seq-dl-num');
         var num = parseInt(numElem.value, 10);
         if (num < 0) {
            num = 0;
         }
         var s = num.toString();
         if (s.length < 4) {
            s = ("0000" + s).substring(s.length);
         }
         if (save(prefix + s + '.png')) {
            numElem.value = num + 1;
         }
      }, false);
   }

   function buildTree(root, redraw) {
      var cid = 0;

      function r(ul, layer, parentLayer) {
         layer.id = ++cid;
         layer.parentLayer = parentLayer;

         var li = document.createElement('li');
         if (layer.Folder) {
            li.classList.add('psdtool-folder');
         }
         layer.li = li;

         var prop = buildLayerProp(layer, parentLayer);
         layer.visibleInput.addEventListener('click', function() {
            for (var p = layer.parentLayer; p.visibleInput; p = p.parentLayer) {
               p.visibleInput.checked = true;
            }
            if (layer.clippedBy) {
               layer.clippedBy.visibleInput.checked = true;
            }
            redraw();
            updateClass(root);
         }, false);
         li.appendChild(prop);

         var children = document.createElement('ul');
         for (var i = layer.Child.length - 1; i >= 0; --i) {
            r(children, layer.Child[i], layer);
         }
         li.appendChild(children);

         ul.appendChild(li);
      }

      var ul = document.getElementById('layer-tree');
      removeAllChild(ul);
      root.id = 'r'
      for (var i = root.Child.length - 1; i >= 0; --i) {
         r(ul, root.Child[i], root);
      }

      var set = {};
      var radios = ul.querySelectorAll('.psdtool-layer-visible[type=radio]');
      for (var i = 0; i < radios.length; ++i) {
         if (radios[i].name in set) {
            continue;
         }
         set[radios[i].name] = 1;
         var rinShibuyas = ul.querySelectorAll('.psdtool-layer-visible[type=radio][name=' + radios[i].name + ']:checked');
         if (!rinShibuyas.length) {
            radios[i].checked = true;
            continue;
         }
         for (var j = 1; j < rinShibuyas.length; ++j) {
            rinShibuyas[j].checked = false;
         }
      }
      updateClass(root);
   }

   function buildLayerProp(layer, parentLayer) {
      var name = document.createElement('label');
      var visible = document.createElement('input');
      var layerName = layer.Name;
      switch (layerName.charAt(0)) {
         case '!':
            visible.className = 'psdtool-layer-visible';
            visible.name = 'l' + layer.id;
            visible.type = 'checkbox';
            visible.checked = true;
            visible.disabled = true;
            visible.style.display = 'none';
            layerName = layerName.substring(1);
            break;
         case '*':
            visible.className = 'psdtool-layer-visible';
            visible.name = 'r' + parentLayer.id;
            visible.type = 'radio';
            visible.checked = layer.Visible;
            layerName = layerName.substring(1);
            break;
         default:
            visible.className = 'psdtool-layer-visible';
            visible.name = 'l' + layer.id;
            visible.type = 'checkbox';
            visible.checked = layer.Visible;
            break;

      }
      layer.visibleInput = visible;
      name.appendChild(visible);

      if (layer.Folder) {
         var icon = document.createElement('span');
         icon.className = 'psdtool-icon glyphicon glyphicon-folder-open';
         icon.setAttribute('aria-hidden', 'true');
         name.appendChild(icon);
      } else if (layer.Canvas) {
         if (layer.Clipping) {
            var clip = document.createElement('img');
            clip.className = 'psdtool-clipped-mark';
            clip.src = 'img/clipped.svg';
            clip.alt = 'clipped mark';
            name.appendChild(clip);
         }
         var thumb = document.createElement('canvas');
         thumb.className = 'psdtool-thumbnail';
         thumb.width = 96;
         thumb.height = 96;
         var w = layer.Canvas.width,
            h = layer.Canvas.height;
         if (w > h) {
            w = thumb.width;
            h = thumb.width / layer.Canvas.width * h;
         } else {
            h = thumb.height;
            w = thumb.height / layer.Canvas.height * w;
         }
         var ctx = thumb.getContext('2d');
         ctx.drawImage(
            layer.Canvas, (thumb.width - w) / 2, (thumb.height - h) / 2, w, h);
         name.appendChild(thumb);
      }
      name.appendChild(document.createTextNode(layerName));

      var div = document.createElement('div');
      div.className = 'psdtool-layer-name';
      div.appendChild(name);
      return div;
   }

   document.addEventListener('DOMContentLoaded', init, false);
})();
