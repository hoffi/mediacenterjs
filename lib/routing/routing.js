/*
	MediaCenterJS - A NodeJS based mediacenter solution

    Copyright (C) 2013 - Jan Smolders

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

var express = require('express')
  , fs = require('fs')
  , colors = require('colors')
  , ini = require('ini')
  , path = require('path')
  , configuration_handler = require('../handlers/configuration-handler');

var config = configuration_handler.initializeConfiguration();
var parent, options;

var loadRoutes = function(_parent, _options) {
	var pluginPrefix = config.pluginPrefix;
	parent = _parent;
	options = _options;

	// read core plugin
	fs.readdirSync(__dirname + '/../../apps').forEach(function(name){
		// Ignore Dotfiles
		if (name.match(/^\.(.*)$/)) {
			return;
		}

		addRoute(name);
	});

	// read plugin install with npm
	fs.readdirSync(__dirname + '/../../node_modules').forEach(function(name){
		if(name.substr(0, pluginPrefix.length) !== pluginPrefix) {
			return;
		}

		addRoute(name, true);
	});
};

/**
 * @param String name 			Name of the plugin: directory name
 * @param Boolean isPlugin		set to true if the plugin is installed via npm in the node_modules directory
 */
var addRoute = function(name, isPlugin) {
	var verbose = options.verbose;
	var bundledAppsPath = path.join(__dirname, '../../apps', name);
	var thirdPartyAppsPath = path.join(__dirname, '../../node_modules', name);

	verbose && console.log('\n   %s:', name .green.bold);

	var obj;
	if (!isPlugin) {
		obj = require(bundledAppsPath);
	} else {
		obj = require(thirdPartyAppsPath);
	}

	var name = obj.name || name
	, prefix = obj.prefix || ''
	, app = express()
	, method
	, routePath
	, routes = []
	, secondaryRoutes = [];


	// allow specifying the view engine
	if (obj.engine) app.set('view engine', obj.engine);

	if (!isPlugin) {
		app.set('views', path.join(bundledAppsPath, 'views'));
	} else {
		//set route for plugin
		app.set('views', path.join(thirdPartyAppsPath, 'views'));

		//set static content for plugin - All static content must be in the /plugin-name/public folder
		parent.use('/' + name + '/public/', express.static(path.join(thirdPartyAppsPath, 'public')));
	}

	app.locals.pretty = true;
	app.locals.basedir = __dirname + '/../../views';

	// before middleware support
	if (obj.before) {
		routePath = '/' + name + '/:' + name + '_id';
		app.all(routePath, obj.before);
		console.log('     ALL %s -> before', routePath);
		routePath = '/' + name + '/:' + name + '_id/*';
		app.all(routePath, obj.before);
		console.log('     ALL %s -> before', routePath);
	}

	for (var key in obj) {
		// "reserved" exports
		if (~['name', 'prefix', 'engine', 'before'].indexOf(key)) continue;

		routes = fs.readFileSync(__dirname +'/routes.js')
		var routesMap = JSON.parse(routes);

		if (routesMap.hasOwnProperty(key)) {
			// Parse default route JSON
			var completeRoute = routesMap[key];
			placeholderPath = completeRoute[0].path;
			routePath = placeholderPath.replace('NAME', name);
			method = completeRoute[0].method;
		} else if (fs.existsSync('./apps/' + name + '/route.js')) {
			// Parse app specific route JSON if present
			secondaryRoutes = fs.readFileSync('./apps/' + name + '/route.js')
			var secondaryRoutesMap = JSON.parse(secondaryRoutes);

			if (secondaryRoutesMap.hasOwnProperty(key)) {
				var completeRoute = secondaryRoutesMap[key];
				placeholderPath = completeRoute[0].path;
				routePath = placeholderPath.replace('NAME',name);
				method = completeRoute[0].method;
			}
		} else {
			console.log('\n   Broken route reference found.' .red.bold)
		}

		routePath = prefix + routePath;
		app[method](routePath, obj[key]);
		verbose && console.log('     %s %s -> %s', method.toUpperCase(), routePath, key);
	}

	// mount the app
	parent.use(app);
}

//Delete routes.
var deleteRoute = function(name){
	var getRoutes = parent.routes.get;
	console.log(parent.routes);
	// for (var k in getRoutes){
	// 	if (getRoutes[k].path && getRoutes[k].path === '/' + name){
	// 		getRoutes.slice(k, 1);
	// 		return;
	// 	}
	// }
}

exports.addRoute = addRoute;
exports.deleteRoute = deleteRoute;
exports.loadRoutes = loadRoutes;
