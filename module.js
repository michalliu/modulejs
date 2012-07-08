/**
 * module.js
 *
 */
/*global document,setTimeout,clearTimeout*/
var require;
var define;
(function (root, thisScript, apIndexOf, apSlice, head, _module) {
    'use strict';

    // in order to allow us using information from the script tag
    thisScript = 'module.js';
    apIndexOf = Array.prototype.indexOf;
    apSlice = Array.prototype.slice;

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

    // loop through an array where 'cb' is a callback function, if 'cb' 
    // returns false exactly, then break the loop
    function _each(a, cb, i, l) {
        for (i=0,l=a.length;i<l;)if(cb.call(a[i],i,a[i++],l-1)===false)break;
    }

    // normalize url
    function _normalize (path, prevPath) {
        // convert backslashes to forward slashes, remove double slashes
        path = path.replace(/\\/g, '/')
                   .replace(/\/\//g, '/')
        // allow form of 'http://' double slashes
                   .replace(/:\//, '://')
        // replace any matches of "./"  with "/"
                   .replace(/(^|[^\.])(\.\/)/g, "$1");

        do {
            prevPath = path;
        // replace any matches of "some/path/../" with "some/" recursively
            path = path.replace(/([\w,\-]*[\/]{1,})([\.]{2,}\/)/g, "");
        }while(prevPath !== path);

        return path;
    }

    // locateScript by script name returns an object contains base path and
    // the script node. the script can only be located **ONCE**
    function _locateScript (inName,l,ret) {
        l = inName.length;
        _each(document.getElementsByTagName('script'), function (i, s, src) {
            if (!s.located) {
                src = s.getAttribute('src') || '';
                if (src.slice(-l) === inName) {
                    s.located = true;
                    ret = {
                        path: src.slice(0, Math.max(0, src.lastIndexOf('/'))),
                        node: s
                    };
                    return false;
                }
            }
        });
        return ret;
    }

    // replace path with macros, thus 'require.macros'
    function _rewritePath (path, working) {
        function fn (macro, name, ret) {
            working = true;
            ret = _require.macros[name];
            // don't change anything if no macro defined
            if (!ret) { working = false; return macro;} 
            // includeTrailingSlash
            return ret.slice(-1) !== '/' ? ret + '/' : ret;
        }
        do{
            working = false;
            // match $name
            path = path && path.replace(/\$([^\/\\]*)(\/)?/g, fn);
        } while(path && working);
        return path;
    }

    // get module url
    function _getURL(path, prefix) {
        prefix = _rewritePath(_require.paths[0]) || _require.args.root;
        // don't use global path configuration if path is absolute
        if(!path.indexOf("/") || !path.indexOf("http")) prefix = '';
        return prefix + path + '.js';
    }

    // inject scripts for module
    function _injectScript(src, module) {
        var script,timer;
        head = head || document.getElementsByTagName('head')[0];
        script = document.createElement("script");
        script.src = src;
        // clear timer and variable
        function clear() {
            clearTimeout(timer);
            script.onreadystatechange = script.onload = script.onerror = null;
        }
        // cross-browser script onload event
        // IE will recognize onreadystatechange event,others will recognize 
        // onload
        // the 'onload' event fires after script code executed
        script.onreadystatechange = script.onload = function (defs, def) {
            defs = _module.defines;
            // IE will have readyState
            var state = this.readyState;
            if (!state || state.match(/complete|loaded/)) {
                clear();
                def = defs.shift();
                if (def) {
                    def.push(module);
                    // def = [dependencies, factory, module]
                    _define.apply(root,def);
                }
            }
        };
        // fires when timeout or non-200 http status
        script.onerror = function () {
            clear();
            throw src + ' failed to load';
        };
        timer = setTimeout(script.onerror, 5000);
        head.insertBefore(script,head.firstChild);
    }

    // handle module dependencies when 'define' is called
    function _handleCircularReferences(module, dependencies) {

        var depsMap = _module.dependencies;
        var subDeps;

        depsMap[module] = dependencies;

        /**
         * non circular reference example
         *
         * Deps Map:
         *
         * {
         *  "a" : ["b", "c"]
         *  "c" : ["d", "e"]
         * }
         *
         * circular reference example
         *
         * Deps Map:
         *
         * {
         *  "a" : ["b", "c"]
         *  "c" : ["d", "a"]
         * }
         *
         */
        _each(dependencies, function (i, d, l) {
            subDeps = depsMap[d];
            if(subDeps) {
                _each(subDeps, function (j, sd, sl) {
                    // subdependency's dependency not in module
                    if (_inArray(sd, dependencies) < 0) {
                        // not reference back to module
                        if (sd !== module) {
                            dependencies.push(sd);
                        }
                        // reference back to module (circular dependency)
                        else { 
                            // define as empty module to be defined later
                            _module.add(d, {exports: {}});
                        }
                    } 
                });
            }
        });
    }
    
    // the javascript modules
    _module = {};

    // store all the modules
    _module.modules = {};

    // store all the async invoked callbacks and there requirements (all the
    // dependency modules needs to be loaded)
    _module.callbacks = [];

    // store the module defination (when module's called 'define')
    _module.defines = [];

    // store the history of module's file to prevent load the same file again
    _module.files = {};

    // store the dependency map for every module
    _module.dependencies = {};

    // reserved modules
    _module.reserved = ['require', 'exports', 'module'];

    // resolve path for one module's id in the given context
    _module.resolvePath = function (id, context) {
        // module id does not starts with '.', it's relative to the base
        // if (id.indexOf('.') < 0) context = '';
        // never resolve the 'reserved' module name
        if (~_inArray(id,_module.reserved)) return id;
        return _normalize( (context ? context + '/' : '') + id );
    };

    // add module's defination, returns the module's defination or module's
    // exported value
    _module.add = function (module, def, noExports) {
        // always return the module for those are reserved
        if (~_inArray(module,_module.reserved)) return module;
        // save some bytes after minified
        var mods = _module.modules;
        _each(module.split('/'), function (i, part, l) {
            mods[part] = l===i ? def : (mods[part] || {});
            mods = mods[part];
        });
        return noExports ? mods : mods.exports;
    };

    // get one module by module name, returns 0 if module not found
    // if noExports is true then return the module itself otherwise returns
    // the exported value of module
    _module.get = function (module, noExports, modFound) {
        // always return the module for those are reserved
        if (~_inArray(module,_module.reserved)) return module;
        // save some bytes after minified
        var mods = _module.modules;
        _each(module.split('/'), function (i, part, l) {
            // the module isn't define or module exports nothing 
            modFound = false;
            if (!mods[part] || (l===i && !mods[part].exports)) return modFound;
            // switch context
            modFound = true;
            mods = mods[part];
        });
        return modFound ? noExports ? mods : mods.exports : 0;
    };

    // load module by injecting script
    _module.load = function (modules, callback, context) {
        // store 'callbacks' and invoke them as soon as 'modules' are ready
        var that = _module;
        var q = {m:modules, cb:callback};
        // save to callback cache
        that.callbacks.push(q);
        _each(modules, function (i, mod, url) {
            url = _getURL(mod);
            // don't overwrite module
            if (!that.files[url] && !that.get(mod)) _injectScript(url, mod);
            that.files[url] = 1; // indicate this url is alreay processed
        });
    };

    // define a module
    function _define (dependencies, factory, module, depsLoaded) {
        // handle the following define pattern
        // 'define (factory)'
        // 'define (object)'
        if (!_isArray(dependencies)) {
            factory = dependencies;
            dependencies = [];
        }

        // 'define ([], factory)'
        if (!module) {
            // we don't know this module's name yet, push it to a cache
            // to be defined upon load
            _module.defines.push([dependencies, factory]);
            return;
        }

        // unix dirname
        var context = module.substr(0, module.lastIndexOf('/'));
        // factory function's length
        var fl = factory.length;

        // commonJS wrapping module
        if (!dependencies.length && fl && typeof factory === 'function') {
            factory.toString()
                .replace(/(\/\*([\s\S]*?)\*\/|([^:]|^)\/\/(.*)$)/mg, "") 
                .replace(/(?:require)\(\s*["']([^'"\s]+)["']\s*\)/g,
                    function ($0, $1) {
                       if(_inArray($1, dependencies)<0)dependencies.push($1);
                    });
            dependencies = _module.reserved.slice(0,fl).concat(dependencies);
        }

        // if dependencies have not been loaded yet,
        if (dependencies.length && !depsLoaded) {

            // handle circular reference
            _handleCircularReferences(module, dependencies.slice(0));

            // after all the deps are loaded reinvoke define with depsLoaded
            // set to true, set context to current module (not global)
            _require(dependencies, function () {
                _define(apSlice.call(arguments,0), factory, module, 1);
            }, context);

            return;
        }

        // actually define the module and run the module factory
        var id = module;
        // get module itself w/o exports
        module = _module.get(module,1);
        // module could be 0 indicate that is not defined
        module = module || {exports: {}};
        module.id = id;
        module.url = _getURL(id);

        if (typeof factory === 'function') {
            // exec the factory function
            /* 
             *  define([], function (require, module, exports) {
             *  })
             *
             *  define(function (require, module, exports) {
             *  })
             *
             *  define(["a","b"],function (a, b, require, module, exports) {
             *  })
             */
            var args = dependencies.length ? dependencies :
                _module.reserved.slice(factory.length);
            var rq;
            // replace 'require', 'module', 'exports' with actual object
            args = _mapArray(args, {
                'require': _require,
                'module': module,
                'exports': module.exports
            });
            rq = _inArray(_require, args);
            if (~rq) {
                args[rq] = _require.localize(context);
            }
            // call the module factory
            module.exports = factory.apply(factory, args) || module.exports;
        } else {
            module.exports = factory;
        }
        _module.add(id, module);
        delete _module.dependencies[id];

        // start invoke the callbacks cached
        var cbs = _module.callbacks;
        _each(cbs, function (i, obj, ready) {
            ready = true;
            // if any module not defined stop the loop
            // the callback is not ready to invoke
            _each(obj.m, function (j, m) {
                if (!_module.get(m)) {
                    ready = false;
                    return ready;
                }
            });
            if (ready) {
                // remove callback will be invoked
                cbs.splice(i,1);
                // invoke the callback
                _require(obj.m, obj.cb);
            }
        });
    }

    function _require (dependencies, callback, context) {
        var mutiDeps = _isArray(dependencies);
        var ids = !mutiDeps ? [dependencies] : dependencies;
        var moduleMap = {'require': _require};
        var resolve = _module.resolvePath;
        // sync-like require
        // if all module are defined then returned as ordered
        // if any module wasn't defined then throw an error
        if (!callback) {
            // resue the variable callback as returned value
            callback = [];
            _each(ids, function (i, id, mod) {
                mod = _module.get(resolve(id, context));
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
            ids[i] = resolve(id, context);
            modules.push(_module.get(ids[i]));
        });
        // returns undefined
        if(~_inArray(0,modules)) return _module.load(ids, callback, context);

        // all the modules are defined callback invoked immediately
        return callback.apply(root, _mapArray(modules, moduleMap));
    }

    // store the information of this script itself
    _require.args = {};
    thisScript = _locateScript(thisScript);
    if (thisScript) {
        _require.args.root = thisScript.path;
        _each(thisScript.node.attributes, function (i,attr) {
            _require.args[attr.nodeName] = attr.value;
        });
    }
    // a prioritized Array of path Strings, from high to low
    _require.paths = [];
    // store macros of the form '$pathname' with the mapped value
    _require.macros = {};

    // Returns a localized version of require
    _require.localize = function (context) {

        function localRequire (ids, callback) {
            return _require(ids, callback, context);
        }

        return localRequire;
    };
    
    // expose
    require = _require;
    define = _define;

})(this);
