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
            var req = indexedDB.open(databaseName, 1);
            req.onupgradeneeded = function (e) {
                var db = e.target.result;
                db.createObjectStore(fileStoreName);
            };
            req.onerror = function (e) {
                error(e);
            };
            req.onsuccess = function (e) {
                _this.db = e.target.result;
                _this.gc(function (err) { return undefined; });
                success();
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
            var req = os.openCursor(IDBKeyRange.bound(['meta', ''], ['meta', []], false, true));
            var d = new Date().getTime() - 60 * 1000;
            req.onsuccess = function (e) {
                var cur = req.result;
                if (!cur) {
                    return;
                }
                if (cur.value.lastMod.getTime() < d) {
                    _this.remove(os, cur.key[1], error);
                }
                cur.advance(1);
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
            var req = os.delete(IDBKeyRange.bound(['body', id, 0], ['body', id, ''], false, true));
            req.onsuccess = function (e) {
                os.delete(['meta', id]);
            };
        };
        Zipper.prototype.add = function (name, blob, complete, error) {
            if (!this.db) {
                return;
            }
            var reqs = 2;
            this.db.onerror = error;
            var tx = this.db.transaction(fileStoreName, 'readwrite');
            tx.onerror = error;
            var os = tx.objectStore(fileStoreName);
            os.put({ lastMod: new Date() }, ['meta', this.id]);
            var req = os.put(blob, ['body', this.id, this.fileInfos.length]);
            req.onsuccess = function (e) {
                if (!--reqs) {
                    complete();
                }
            };
            req.onerror = error;
            this.fileInfos.push(new FileInfo(name, blob, function () {
                if (!--reqs) {
                    complete();
                }
            }, error));
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
            os.put({ lastMod: new Date() }, ['meta', this.id]);
            this.receiveFiles(function (blobs) {
                complete(_this.makeZIP(blobs));
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
                var req = os.get(['body', _this.id, i]);
                req.onsuccess = function (e) {
                    blobs[i] = e.target.result;
                    if (!--reqs) {
                        success(blobs);
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
                pos += fi.fileSize + fi.localFileHeaderSize;
                cdrSize += fi.centralDirectoryRecordSize;
            });
            zip.push(Zip.buildEndOfCentralDirectory(this.fileInfos.length, cdrSize, pos));
            return new Blob(zip, { type: 'application/zip' });
        };
        return Zipper;
    }());
    Zipper_1.Zipper = Zipper;
    var FileInfo = (function () {
        function FileInfo(name, data, complete, error) {
            var _this = this;
            this.date = new Date();
            this.size = data.size;
            var reqs = 2;
            var fr = new FileReader();
            fr.onload = function (e) {
                _this.crc = CRC32.crc32(e.target.result);
                if (!--reqs) {
                    complete();
                }
            };
            fr.onerror = function (e) {
                error(e.target.error);
            };
            fr.readAsArrayBuffer(data);
            var nr = new FileReader();
            nr.onload = function (e) {
                _this.name = e.target.result;
                if (!--reqs) {
                    complete();
                }
            };
            nr.onerror = function (e) {
                error(e.target.error);
            };
            nr.readAsArrayBuffer(new Blob([name]));
        }
        Object.defineProperty(FileInfo.prototype, "fileSize", {
            get: function () {
                return this.size;
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
        FileInfo.prototype.toLocalFileHeader = function () {
            return Zip.buildLocalFileHeader(this.name, this.crc, this.date, this.size);
        };
        Object.defineProperty(FileInfo.prototype, "centralDirectoryRecordSize", {
            get: function () {
                return Zip.calcCentralDirectoryRecordSize(this.name);
            },
            enumerable: true,
            configurable: true
        });
        FileInfo.prototype.toCentralDirectoryRecord = function (lfhOffset) {
            return Zip.buildCentralDirectoryRecord(this.name, this.crc, this.date, this.size, lfhOffset);
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
        Zip.buildLocalFileHeader = function (name, crc, lastMod, fileSize) {
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
            v.setUint16(8, 0x0000, true);
            // Last mod file time
            v.setUint16(10, d & 0xffff, true);
            // Last mod file date
            v.setUint16(12, (d >>> 16) & 0xffff, true);
            // CRC-32
            v.setUint32(14, crc, true);
            // Compressed size
            v.setUint32(18, fileSize, true);
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
        Zip.buildCentralDirectoryRecord = function (name, crc, lastMod, fileSize, lfhOffset) {
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
            v.setUint16(10, 0x0000, true);
            // Last mod file time
            v.setUint16(12, d & 0xffff, true);
            // Last mod file date
            v.setUint16(14, (d >>> 16) & 0xffff, true);
            // CRC-32
            v.setUint32(16, crc, true);
            // Compressed size
            v.setUint32(20, fileSize, true);
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
        return Zip;
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
