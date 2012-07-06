/**
 * module.js
 *
 */
//TODO: Module.load
var require;
var define;
(function (root) {
    'use strict';

    var apIndexOf = Array.prototype.indexOf;

    // Returns the first index at which a given element can be found in the
    // array, or -1 if it is not present
    function _inArray(elem, array, l, r) {
        if(apIndexOf) return apIndexOf.call(array, elem);
        for (l = array.length, r = -1; ~l; r = array[--l] === elem ? l : r);
        return r;
    }

    // returns true if 'it' is array
    function _isArray(it) {
        return it instanceof Array;
    }

    // map an array's element by a given object
    function _mapArray(array, obj, j) {
        for (var i in obj) {
            j = _inArray(i, array);
            if (~j) array[j] = obj[i];
        }
        return array;
    }

    // loop through an array or array-like object
    // 'cb' is a callback function, if 'cb' returns false, then break the loop
    function _each(it, cb, i, l) {
        for (i=0,l=it.length;i<l;)if(cb.call(it[i],i,it[i++],l-1)===false)break;
    }

    // normalize url
    function _normalize (path, prevPath) {
        // Replace any matches of "./"  with "/"
        path = path.replace(/(^|[^\.])(\.\/)/g, "$1");

        // Replace any matches of "some/path/../" with "some/"
        while (prevPath !== path) { // break if nothing to replace
            prevPath = path;
            path = path.replace(/([\w,\-]*[\/]{1,})([\.]{2,}\/)/g, "");
        }

        // Replace any matches of multiple "/" with a single "/"
        return path.replace(/(\/{2,})/g, "/");
    }
    
    // the javascript modules
    function Module (id, def) {
    }

    // store all the modules
    Module.modules = {};

    // reserved module
    Module.reserved = ['require', 'exports', 'module'];

    // resolve path for one module's id in the given context
    Module.resolvePath = function (id, context) {
        // module id does not starts with '.', it's relative to the base
        if (id.indexOf('.') < 0) context = '';
        // never resolve the 'reserved' module name to absolute path
        if (~_inArray(id,this.reserved)) return id;
        return _normalize( (context ? context + '/' : '') + id );
    };

    // add module's defination, returns the module's defination or module's
    // exported value
    Module.add = function (id, def, noExports) {
        // always return the id for those are reserved module
        if (~_inArray(id,this.reserved)) return id;
        // save some bytes after minified
        var mods = this.modules;
        _each(id.split('/'), function (i, part, l) {
            mods[part] = l===i ? def : (mods[part] || {});
            mods = mods[part];
        });
        return noExports ? mods : mods.exports;
    };

    // get one module by module id, returns 0 if module not found
    // if noExports is true then return the module itself otherwise returns
    // the exported value of module
    Module.get = function (id, noExports, modFound) {
        // always return the id for those are reserved module
        if (~_inArray(id,this.reserved)) return id;
        // save some bytes after minified
        var mods = this.modules;
        _each(id.split('/'), function (i, part, l) {
            // the module isn't define or module exports nothing 
            modFound = false;
            if (!mods[part] || (l===i && !mods[part].exports)) return modFound;
            // switch context
            modFound = true;
            mods = mods[part];
        });
        return modFound ? noExports ? mods : mods.exports : 0;
    };

    Module.load = function () {
    };

    function _require (dependencies, callback, context) {
        var mutiDeps = _isArray(dependencies);
        var ids = !mutiDeps ? [dependencies] : dependencies;
        var moduleMap = {'require': _require};
        // sync-like require
        // if all module are defined then returned as ordered
        // if any module wasn't defined then throw an error
        if (!callback) {
            // resue the variable callback as returned value
            callback = [];
            _each(ids, function (i, id, mod) {
                mod = Module.get(Module.resolvePath(id, context));
                if (!mod) throw id + ' is not defined.';
                callback.push(mod);
            });
            callback = _mapArray(callback, moduleMap);
            return mutiDeps ? callback : callback[0];
        }

        // async load dependencies/modules
        // returns nothing if any module is not loaded (contains '0')
        // callback will be invoked as soon as all the modules are defined
        var modules = [];
        _each(ids, function (i, id) {
            ids[i] = Module.resolvePath(id, context);
            modules.push(Module.get(ids[i]));
        });
        if(~_inArray(0,modules)) return Module.load(ids, callback, context);

        // all the modules are defined callback invoked immediately
        return callback.apply(root, _mapArray(modules, moduleMap));
    }

    // expose
    require = _require;
    root.module = Module;
})(this);
