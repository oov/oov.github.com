'use strict';
var Zipper;
(function (Zipper_1) {
    var databaseName = 'zipper';
    var fileStoreName = 'file';
    var Zipper = (function () {
        function Zipper() {
            this.id = Date.now().toString() + Math.random().toString().substring(2);
            this.fileInfos = [];
        }
        Zipper.prototype.init = function (success, error) {
            var _this = this;
            var req = indexedDB.open(databaseName, 2);
            req.onupgradeneeded = function (e) {
                var db = req.result;
                if (db instanceof IDBDatabase) {
                    try {
                        db.deleteObjectStore(fileStoreName);
                    }
                    catch (e) {
                    }
                    db.createObjectStore(fileStoreName);
                    return;
                }
                throw new Error('req.result is not IDBDatabase');
            };
            req.onerror = function (e) { return error(e); };
            req.onsuccess = function (e) {
                var db = req.result;
                if (db instanceof IDBDatabase) {
                    _this.db = db;
                    _this.gc(function (err) { return undefined; });
                    success();
                    return;
                }
                throw new Error('req.result is not IDBDatabase');
            };
        };
        Zipper.prototype.dispose = function (error) {
            this.db.onerror = error;
            var tx = this.db.transaction(fileStoreName, 'readwrite');
            tx.onerror = error;
            var os = tx.objectStore(fileStoreName);
            this.remove(os, this.id, error);
            this.gc(function (err) { return undefined; });
        };
        Zipper.prototype.gc = function (error) {
            var _this = this;
            if (!this.db) {
                return;
            }
            this.db.onerror = error;
            var tx = this.db.transaction(fileStoreName, 'readwrite');
            tx.onerror = error;
            var os = tx.objectStore(fileStoreName);
            var req = os.openCursor(IDBKeyRange.bound('meta_', 'meta`', false, true));
            var d = new Date().getTime() - 60 * 1000;
            req.onsuccess = function (e) {
                var cursor = req.result;
                if (!cursor) {
                    return;
                }
                if (cursor instanceof IDBCursorWithValue) {
                    if (cursor.value.lastMod.getTime() < d) {
                        var key = cursor.key;
                        if (typeof key === 'string') {
                            _this.remove(os, key.split('_')[1], error);
                        }
                    }
                    cursor.continue();
                    return;
                }
            };
            req.onerror = error;
        };
        Zipper.gc = function () {
            new Zipper().init(function () { return undefined; }, function (err) { return undefined; });
        };
        Zipper.prototype.remove = function (os, id, error) {
            if (!this.db) {
                return;
            }
            var req = os.delete(IDBKeyRange.bound('body_' + id + '_', 'body_' + id + '`', false, true));
            req.onsuccess = function (e) {
                os.delete('meta_' + id);
            };
        };
        Zipper.prototype.add = function (name, blob, complete, error) {
            this.addCore(name, blob, false, complete, error);
        };
        Zipper.prototype.addCompress = function (name, blob, complete, error) {
            this.addCore(name, blob, true, complete, error);
        };
        Zipper.prototype.addCore = function (name, blob, compress, complete, error) {
            var _this = this;
            if (!this.db) {
                return;
            }
            var index = this.fileInfos.length;
            var fi = new FileInfo(name, blob, compress, function (compressed) {
                _this.db.onerror = error;
                var tx = _this.db.transaction(fileStoreName, 'readwrite');
                tx.onerror = error;
                var os = tx.objectStore(fileStoreName);
                os.put({ lastMod: new Date() }, 'meta_' + _this.id);
                var req = os.put(new Blob([compressed], { type: 'application/octet-binary' }), 'body_' + _this.id + '_' + index);
                req.onsuccess = function (e) { return complete(); };
                req.onerror = error;
            }, error);
            this.fileInfos.push(fi);
        };
        Zipper.prototype.generate = function (complete, error) {
            var _this = this;
            if (!this.db) {
                throw new Error('Zipper is already disposed');
            }
            this.db.onerror = error;
            var tx = this.db.transaction(fileStoreName, 'readwrite');
            tx.onerror = error;
            var os = tx.objectStore(fileStoreName);
            os.put({ lastMod: new Date() }, 'meta_' + this.id);
            this.receiveFiles(function (blobs) {
                var size = Zip.endOfCentralDirectorySize;
                _this.fileInfos.forEach(function (fi) {
                    size += fi.localFileHeaderSize + fi.compressedFileSize + fi.centralDirectoryRecordSize;
                });
                if (size > 0xffffffff || _this.fileInfos.length > 0xffff) {
                    complete(_this.makeZIP64(blobs));
                }
                else {
                    complete(_this.makeZIP(blobs));
                }
            }, error);
        };
        Zipper.prototype.receiveFiles = function (success, error) {
            var _this = this;
            var reqs = this.fileInfos.length;
            var blobs = new Array(this.fileInfos.length);
            this.db.onerror = error;
            var tx = this.db.transaction(fileStoreName, 'readonly');
            tx.onerror = error;
            var os = tx.objectStore(fileStoreName);
            this.fileInfos.forEach(function (fi, i) {
                var req = os.get('body_' + _this.id + '_' + i);
                req.onsuccess = function (e) {
                    var result = req.result;
                    if (result instanceof Blob) {
                        blobs[i] = result;
                        if (!--reqs) {
                            success(blobs);
                        }
                    }
                };
                req.onerror = error;
            });
        };
        Zipper.prototype.makeZIP = function (fileBodies) {
            var zip = [];
            this.fileInfos.forEach(function (fi, i) {
                zip.push(fi.toLocalFileHeader(), fileBodies[i]);
            });
            var pos = 0, cdrSize = 0;
            this.fileInfos.forEach(function (fi) {
                zip.push(fi.toCentralDirectoryRecord(pos));
                pos += fi.compressedFileSize + fi.localFileHeaderSize;
                cdrSize += fi.centralDirectoryRecordSize;
            });
            zip.push(Zip.buildEndOfCentralDirectory(this.fileInfos.length, cdrSize, pos));
            return new Blob(zip, { type: 'application/zip' });
        };
        Zipper.prototype.makeZIP64 = function (fileBodies) {
            var zip = [];
            var pos = 0;
            this.fileInfos.forEach(function (fi, i) {
                zip.push(fi.toLocalFileHeader64(pos), fileBodies[i]);
                pos += fi.compressedFileSize + fi.localFileHeaderSize64;
            });
            pos = 0;
            var cdrSize = 0;
            this.fileInfos.forEach(function (fi) {
                zip.push(fi.toCentralDirectoryRecord64(pos));
                pos += fi.compressedFileSize + fi.localFileHeaderSize64;
                cdrSize += fi.centralDirectoryRecordSize64;
            });
            zip.push(Zip64.buildEndOfCentralDirectory(this.fileInfos.length, cdrSize, pos));
            return new Blob(zip, { type: 'application/zip' });
        };
        return Zipper;
    }());
    Zipper_1.Zipper = Zipper;
    var FileInfo = (function () {
        function FileInfo(name, data, compress, complete, error) {
            var _this = this;
            this.date = new Date();
            var reqs = 2;
            this.size = data.size;
            this.compressedSize = data.size;
            if (compress) {
                this.compressionMethod = 8; // deflate
                ++reqs;
            }
            else {
                this.compressionMethod = 0; // stored
            }
            var ab;
            var fr = new FileReader();
            fr.onload = function (e) {
                var result = fr.result;
                if (result instanceof ArrayBuffer) {
                    ab = result;
                    _this.crc = CRC32.crc32(result);
                    if (!--reqs) {
                        complete(ab);
                        return;
                    }
                    if (compress) {
                        Zip.deflate(result, function (compressed) {
                            ab = compressed;
                            _this.compressedSize = compressed.byteLength;
                            if (!--reqs) {
                                complete(ab);
                            }
                        });
                    }
                }
            };
            fr.onerror = function (e) { return error(fr.error); };
            fr.readAsArrayBuffer(data);
            var nr = new FileReader();
            nr.onload = function (e) {
                var result = nr.result;
                if (result instanceof ArrayBuffer) {
                    _this.name = result;
                    if (!--reqs) {
                        complete(ab);
                    }
                }
            };
            nr.onerror = function (e) { return error(nr.error); };
            nr.readAsArrayBuffer(new Blob([name]));
        }
        Object.defineProperty(FileInfo.prototype, "fileSize", {
            get: function () {
                return this.size;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(FileInfo.prototype, "compressedFileSize", {
            get: function () {
                return this.compressedSize;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(FileInfo.prototype, "localFileHeaderSize", {
            get: function () {
                return Zip.calcLocalFileHeaderSize(this.name);
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(FileInfo.prototype, "localFileHeaderSize64", {
            get: function () {
                return Zip64.calcLocalFileHeaderSize(this.name);
            },
            enumerable: true,
            configurable: true
        });
        FileInfo.prototype.toLocalFileHeader = function () {
            return Zip.buildLocalFileHeader(this.name, this.crc, this.date, this.compressionMethod, this.size, this.compressedSize);
        };
        FileInfo.prototype.toLocalFileHeader64 = function (lfhOffset) {
            return Zip64.buildLocalFileHeader(this.name, this.crc, this.date, this.compressionMethod, this.size, this.compressedSize, lfhOffset);
        };
        Object.defineProperty(FileInfo.prototype, "centralDirectoryRecordSize", {
            get: function () {
                return Zip.calcCentralDirectoryRecordSize(this.name);
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(FileInfo.prototype, "centralDirectoryRecordSize64", {
            get: function () {
                return Zip64.calcCentralDirectoryRecordSize(this.name);
            },
            enumerable: true,
            configurable: true
        });
        FileInfo.prototype.toCentralDirectoryRecord = function (lfhOffset) {
            return Zip.buildCentralDirectoryRecord(this.name, this.crc, this.date, this.compressionMethod, this.size, this.compressedSize, lfhOffset);
        };
        FileInfo.prototype.toCentralDirectoryRecord64 = function (lfhOffset) {
            return Zip64.buildCentralDirectoryRecord(this.name, this.crc, this.date, this.compressionMethod, this.size, this.compressedSize, lfhOffset);
        };
        return FileInfo;
    }());
    // Reference: http://www.onicos.com/staff/iz/formats/zip.html
    var Zip = (function () {
        function Zip() {
        }
        Zip.calcLocalFileHeaderSize = function (name) {
            return 30 + name.byteLength + 9 + name.byteLength;
        };
        Zip.buildLocalFileHeader = function (name, crc, lastMod, compressionMethod, fileSize, compressedSize) {
            var d = Zip.formatDate(lastMod);
            var lfh = new ArrayBuffer(30), extraField = new ArrayBuffer(9);
            var v = new DataView(lfh);
            // Local file header signature
            v.setUint32(0, 0x04034b50, true);
            // Version needed to extract
            v.setUint16(4, 0x000a, true);
            // General purpose bit flag
            // 0x0800 = the file name is encoded with UTF-8
            v.setUint16(6, 0x0800, true);
            // Compression method
            // 0 = stored (no compression)
            v.setUint16(8, compressionMethod, true);
            // Last mod file time
            v.setUint16(10, d & 0xffff, true);
            // Last mod file date
            v.setUint16(12, (d >>> 16) & 0xffff, true);
            // CRC-32
            v.setUint32(14, crc, true);
            // Compressed size
            v.setUint32(18, compressedSize, true);
            // Uncompressed size
            v.setUint32(22, fileSize, true);
            // Filename length
            v.setUint16(26, name.byteLength, true);
            // Extra field length
            // https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT
            // 4.6.9 -Info-ZIP Unicode Path Extra Field (0x7075):
            // Value         Size        Description
            // -----         ----        -----------
            // 0x7075        Short       tag for this extra block type ("up")
            // TSize         Short       total data size for this block
            // Version       1 byte      version of this extra field, currently 1
            // NameCRC32     4 bytes     File Name Field CRC32 Checksum
            // UnicodeName   Variable    UTF-8 version of the entry File Name
            v.setUint16(28, extraField.byteLength + name.byteLength, true);
            v = new DataView(extraField);
            // Tag for this extra block type
            v.setUint16(0, 0x7075, true);
            // TSize
            v.setUint16(2, 5 + name.byteLength, true);
            // Version
            v.setUint8(4, 0x01);
            // NameCRC32
            v.setUint32(5, CRC32.crc32(name), true);
            return new Blob([lfh, name, extraField, name]);
        };
        Zip.calcCentralDirectoryRecordSize = function (name) {
            return 46 + name.byteLength + 9 + name.byteLength;
        };
        Zip.buildCentralDirectoryRecord = function (name, crc, lastMod, compressionMethod, fileSize, compressedSize, lfhOffset) {
            var d = Zip.formatDate(lastMod);
            var cdr = new ArrayBuffer(46), extraField = new ArrayBuffer(9);
            var v = new DataView(cdr);
            // Central file header signature
            v.setUint32(0, 0x02014b50, true);
            // Version made by
            v.setUint16(4, 0x0014, true);
            // Version needed to extract
            v.setUint16(6, 0x000a, true);
            // General purpose bit flag
            // 0x0800 = the file name is encoded with UTF-8
            v.setUint16(8, 0x0800, true);
            // Compression method
            // 0 = stored (no compression)
            v.setUint16(10, compressionMethod, true);
            // Last mod file time
            v.setUint16(12, d & 0xffff, true);
            // Last mod file date
            v.setUint16(14, (d >>> 16) & 0xffff, true);
            // CRC-32
            v.setUint32(16, crc, true);
            // Compressed size
            v.setUint32(20, compressedSize, true);
            // Uncompressed size
            v.setUint32(24, fileSize, true);
            // Filename length
            v.setUint16(28, name.byteLength, true);
            // Extra field length
            v.setUint16(30, extraField.byteLength + name.byteLength, true);
            // File comment length
            v.setUint16(32, 0, true);
            // Disk number start
            v.setUint16(34, 0, true);
            // Internal file attributes
            v.setUint16(36, 0, true);
            // External file attributes
            v.setUint32(38, 0, true);
            // Relative offset of local header
            v.setUint32(42, lfhOffset, true);
            v = new DataView(extraField);
            // Tag for this extra block type
            v.setUint16(0, 0x7075, true);
            // TSize
            v.setUint16(2, 5 + name.byteLength, true);
            // Version
            v.setUint8(4, 0x01);
            // NameCRC32
            v.setUint32(5, CRC32.crc32(name), true);
            return new Blob([cdr, name, extraField, name]);
        };
        Zip.formatDate = function (d) {
            if (!d) {
                d = new Date();
            }
            var date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
            var time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() / 2);
            return (date << 16) | time; // YYYYYYYm mmmddddd HHHHHMMM MMMSSSSS
        };
        Object.defineProperty(Zip, "endOfCentralDirectorySize", {
            get: function () {
                return 22;
            },
            enumerable: true,
            configurable: true
        });
        Zip.buildEndOfCentralDirectory = function (files, cdrSize, cdrOffset) {
            var eoc = new ArrayBuffer(22);
            var v = new DataView(eoc);
            // End of central dir signature
            v.setUint32(0, 0x06054b50, true);
            // Number of this disk
            v.setUint16(4, 0, true);
            // Number of the disk with the start of the central directory
            v.setUint16(6, 0, true);
            // Total number of entries in the central dir on this disk
            v.setUint16(8, files, true);
            // Total number of entries in the central dir
            v.setUint16(10, files, true);
            // Size of the central directory
            v.setUint32(12, cdrSize, true);
            // Offset of start of central directory with respect to the starting disk number
            v.setUint32(16, cdrOffset, true);
            // zipfile comment length
            v.setUint16(20, 0, true);
            return new Blob([eoc]);
        };
        Zip.deflate = function (b, callback) {
            if (!Zip.worker) {
                Zip.worker = new Worker(Zip.createWorkerURL());
                Zip.worker.onmessage = function (e) {
                    var f = Zip.compressQueue.shift();
                    if (f) {
                        f(e.data);
                    }
                };
            }
            Zip.compressQueue.push(callback);
            Zip.worker.postMessage(b, [b]);
        };
        Zip.createWorkerURL = function () {
            if (Zip.workerURL) {
                return Zip.workerURL;
            }
            Zip.workerURL = URL.createObjectURL(new Blob(["\n'use strict';\nimportScripts('https://cdnjs.cloudflare.com/ajax/libs/pako/1.0.3/pako_deflate.min.js');\nonmessage = function(e){\n   var b = pako.deflateRaw(e.data).buffer;\n   postMessage(b, [b]);\n}\n"], { type: 'text/javascript' }));
            return Zip.workerURL;
        };
        Zip.compressQueue = [];
        return Zip;
    }());
    var Zip64 = (function () {
        function Zip64() {
        }
        Zip64.calcLocalFileHeaderSize = function (name) {
            return 30 + name.byteLength + 32 + 9 + name.byteLength;
        };
        Zip64.buildLocalFileHeader = function (name, crc, lastMod, compressionMethod, fileSize, compressedSize, lfhOffset) {
            var d = Zip64.formatDate(lastMod);
            var lfh = new ArrayBuffer(30), extraFieldZip64 = new ArrayBuffer(32), extraFieldName = new ArrayBuffer(9);
            var v = new DataView(lfh);
            // Local file header signature
            v.setUint32(0, 0x04034b50, true);
            // Version needed to extract
            v.setUint16(4, 0x002d, true);
            // General purpose bit flag
            // 0x0800 = the file name is encoded with UTF-8
            v.setUint16(6, 0x0800, true);
            // Compression method
            // 0 = stored (no compression)
            v.setUint16(8, compressionMethod, true);
            // Last mod file time
            v.setUint16(10, d & 0xffff, true);
            // Last mod file date
            v.setUint16(12, (d >>> 16) & 0xffff, true);
            // CRC-32
            v.setUint32(14, crc, true);
            // Compressed size
            v.setUint32(18, 0xffffffff, true);
            // Uncompressed size
            v.setUint32(22, 0xffffffff, true);
            // Filename length
            v.setUint16(26, name.byteLength, true);
            // Extra field length
            // https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT
            v.setUint16(28, extraFieldZip64.byteLength + extraFieldName.byteLength + name.byteLength, true);
            // 4.5.3 -Zip64 Extended Information Extra Field (0x0001):
            // Value      Size       Description
            // -----      ----       -----------
            // 0x0001     2 bytes    Tag for this "extra" block type
            // Size       2 bytes    Size of this "extra" block
            // Original
            // Size       8 bytes    Original uncompressed file size
            // Compressed
            // Size       8 bytes    Size of compressed data
            // Relative Header
            // Offset     8 bytes    Offset of local header record
            // Disk Start
            // Number     4 bytes    Number of the disk on which
            //                       this file starts
            v = new DataView(extraFieldZip64);
            // Tag for this extra block type
            v.setUint16(0, 0x0001, true);
            // Size
            v.setUint16(2, 28, true);
            // Original Size
            Zip64.setUint64(v, 4, fileSize);
            // Compressed Size
            Zip64.setUint64(v, 12, compressedSize);
            // Relative Header Offset
            Zip64.setUint64(v, 20, lfhOffset);
            // Disk Start Number
            v.setUint32(28, 0);
            // 4.6.9 -Info-ZIP Unicode Path Extra Field (0x7075):
            // Value         Size        Description
            // -----         ----        -----------
            // 0x7075        Short       tag for this extra block type ("up")
            // TSize         Short       total data size for this block
            // Version       1 byte      version of this extra field, currently 1
            // NameCRC32     4 bytes     File Name Field CRC32 Checksum
            // UnicodeName   Variable    UTF-8 version of the entry File Name
            v = new DataView(extraFieldName);
            // Tag for this extra block type
            v.setUint16(0, 0x7075, true);
            // TSize
            v.setUint16(2, 5 + name.byteLength, true);
            // Version
            v.setUint8(4, 0x01);
            // NameCRC32
            v.setUint32(5, CRC32.crc32(name), true);
            return new Blob([lfh, name, extraFieldZip64, extraFieldName, name]);
        };
        Zip64.calcCentralDirectoryRecordSize = function (name) {
            return 46 + name.byteLength + 32 + 9 + name.byteLength;
        };
        Zip64.buildCentralDirectoryRecord = function (name, crc, lastMod, compressionMethod, fileSize, compressedSize, lfhOffset) {
            var d = Zip64.formatDate(lastMod);
            var cdr = new ArrayBuffer(46), extraFieldZip64 = new ArrayBuffer(32), extraFieldName = new ArrayBuffer(9);
            var v = new DataView(cdr);
            // Central file header signature
            v.setUint32(0, 0x02014b50, true);
            // Version made by
            v.setUint16(4, 0x002d, true);
            // Version needed to extract
            v.setUint16(6, 0x002d, true);
            // General purpose bit flag
            // 0x0800 = the file name is encoded with UTF-8
            v.setUint16(8, 0x0800, true);
            // Compression method
            // 0 = stored (no compression)
            v.setUint16(10, compressionMethod, true);
            // Last mod file time
            v.setUint16(12, d & 0xffff, true);
            // Last mod file date
            v.setUint16(14, (d >>> 16) & 0xffff, true);
            // CRC-32
            v.setUint32(16, crc, true);
            // Compressed size
            v.setUint32(20, 0xffffffff, true);
            // Uncompressed size
            v.setUint32(24, 0xffffffff, true);
            // Filename length
            v.setUint16(28, name.byteLength, true);
            // Extra field length
            v.setUint16(30, extraFieldZip64.byteLength + extraFieldName.byteLength + name.byteLength, true);
            // File comment length
            v.setUint16(32, 0, true);
            // Disk number start
            v.setUint16(34, 0xffff, true);
            // Internal file attributes
            v.setUint16(36, 0, true);
            // External file attributes
            v.setUint32(38, 0, true);
            // Relative offset of local header
            v.setUint32(42, 0xffffffff, true);
            v = new DataView(extraFieldZip64);
            // Tag for this extra block type
            v.setUint16(0, 0x0001, true);
            // Size
            v.setUint16(2, 28, true);
            // Original Size
            Zip64.setUint64(v, 4, fileSize);
            // Compressed Size
            Zip64.setUint64(v, 12, compressedSize);
            // Relative Header Offset
            Zip64.setUint64(v, 20, lfhOffset);
            // Disk Start Number
            v.setUint32(28, 0);
            v = new DataView(extraFieldName);
            // Tag for this extra block type
            v.setUint16(0, 0x7075, true);
            // TSize
            v.setUint16(2, 5 + name.byteLength, true);
            // Version
            v.setUint8(4, 0x01);
            // NameCRC32
            v.setUint32(5, CRC32.crc32(name), true);
            return new Blob([cdr, name, extraFieldZip64, extraFieldName, name]);
        };
        Zip64.formatDate = function (d) {
            if (!d) {
                d = new Date();
            }
            var date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
            var time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() / 2);
            return (date << 16) | time; // YYYYYYYm mmmddddd HHHHHMMM MMMSSSSS
        };
        Object.defineProperty(Zip64, "endOfCentralDirectorySize", {
            get: function () {
                return 22 + 56 + 20;
            },
            enumerable: true,
            configurable: true
        });
        Zip64.buildEndOfCentralDirectory = function (files, cdrSize, cdrOffset) {
            var eoc = new ArrayBuffer(22), eoc64 = new ArrayBuffer(56), eocl64 = new ArrayBuffer(20);
            var v = new DataView(eoc64);
            // zip64 end of central dir signature
            v.setUint32(0, 0x06064b50, true);
            // size of zip64 end of central directory record
            Zip64.setUint64(v, 4, eoc64.byteLength + eocl64.byteLength + eoc.byteLength - 12);
            // version made by
            v.setUint16(12, 0x002d, true);
            // version needed to extract
            v.setUint16(14, 0x002d, true);
            // number of this disk
            v.setUint32(16, 0, true);
            // number of the disk with the start of the central directory
            v.setUint32(20, 0, true);
            // total number of entries in the central directory on this disk
            Zip64.setUint64(v, 24, files);
            // total number of entries in the central directory
            Zip64.setUint64(v, 32, files);
            // size of the central directory
            Zip64.setUint64(v, 40, cdrSize);
            // offset of start of central directory with respect to the starting disk number
            Zip64.setUint64(v, 48, cdrOffset);
            v = new DataView(eocl64);
            // zip64 end of central dir locator signature
            v.setUint32(0, 0x07064b50, true);
            // number of the disk with the start of the zip64 end of central directory
            v.setUint32(4, 0, true);
            // relative offset of the zip64 end of central directory record
            Zip64.setUint64(v, 8, cdrOffset + cdrSize);
            // total number of disks
            v.setUint32(16, 1, true);
            v = new DataView(eoc);
            // End of central dir signature
            v.setUint32(0, 0x06054b50, true);
            // Number of this disk
            v.setUint16(4, 0xffff, true);
            // Number of the disk with the start of the central directory
            v.setUint16(6, 0xffff, true);
            // Total number of entries in the central dir on this disk
            v.setUint16(8, 0xffff, true);
            // Total number of entries in the central dir
            v.setUint16(10, 0xffff, true);
            // Size of the central directory
            v.setUint32(12, 0xffffffff, true);
            // Offset of start of central directory with respect to the starting disk number
            v.setUint32(16, 0xffffffff, true);
            // zipfile comment length
            v.setUint16(20, 0, true);
            return new Blob([eoc64, eocl64, eoc]);
        };
        Zip64.setUint64 = function (v, offset, value) {
            v.setUint32(offset, value & 0xffffffff, true);
            v.setUint32(offset + 4, Math.floor(value / 0x100000000), true);
        };
        return Zip64;
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
})(Zipper || (Zipper = {}));
Zipper.Zipper.gc();
