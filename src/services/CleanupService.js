/* *********************************************************************************************
NG-GRID CLEANUP SERVICE CLEANS UP MEMORY (MORE) PROPERLY ON DESTROY

3 Changes to ng-grid.js to make it work:

1) Inject it into the ngGrid directive declaration as $cleanupService.

2) add one call, after the eventProvider is added to the grid, like so:

decorateDirectiveForMemory = new ngEventProvider(grid, $scope, domUtilityService, $timeout);

// CLEANUP INJECT
cleanupService.decorateDirectiveForMemory($scope, $element, grid);

3) Comment out the internal call to self.assignEvents() from within the eventProvider definition.

These changes probalby don't clean up every leak, but this does so far seem to prevent
any old ngGrid instances hanging around in the heap long after the grid is gone, as v13 does.
********************************************************************************************** */

'use strict';

angular.module('ngGrid.services').factory('$cleanupService', ['$timeout', function($timeout) {
	var cleanupService = {};

	// merciless destruction of functions and elements on the object.
	// Almost every function on any object had closure issues with the grid, rows or columns.
	function cleanupObject(obj) {
		for (var prop in obj) {
			if (obj.hasOwnProperty(prop)) {
				obj[prop] = null;
			}
		}
	}

	// Remove some special items on the grid before stripping it
	function cleanupGrid(grid) {
		grid.searchProvider && (grid.searchProvider.extFilter = null);

		$(grid.$headerScroller).remove();
		$(grid.$viewport).remove();
		// might need to walk through these and clean up elements before freeing.
		//grid.data = null;
		for (var row in grid.rowCache) {
			cleanupRow(grid.rowCache[row]);
		}

		cleanupObject(grid);
	}

	// Cleanup the row
	function cleanupRow(row) {
		if (row.clone) {
			cleanupRow(row.clone);
			row.clone.orig = null;
		}
		//row.col = null;
		cleanupObject(row);
	}

	// Note that in the heap snapshots, you'll still see the current grid's
	// $$watcher containing the "last" version of the columns. Those we don't want to go away.
	function cleanupColumn(col) {
		cleanupObject(col);
	}

	// for an unknown-as-yet reason, the directive scope doesn't get destroyed, but the proto
	// scope from which it inherited when using scope:true on the directive WAS destroyed.
	// So to get rid of memory, you gotta put destroy back on the scope. scope is v1.2.25's version,
	// slightly modified.
	function addBackDollarDestroy(scope) {
		scope.$destroy = function() {
			// we can't destroy the root scope or a scope that has been already destroyed
			// MOD: we can't keep this line, because proto.$$destroyed is true and it won't
			// destroy the scope.
			//if (scope.$$destroyed) return;

			function decrementListenerCount(current, count, name) {
				do {
					current.$$listenerCount[name] -= count;

					if (current.$$listenerCount[name] === 0) {
						delete current.$$listenerCount[name];
					}
				} while ((current = current.$parent));
			}
			var parent = scope.$parent;

			//scope.$broadcast('$destroy');
			scope.$$destroyed = true;
			//if (scope === $rootScope) return;

			angular.forEach(scope.$$listenerCount, angular.bind(null, decrementListenerCount, scope));

			// sever all the references to parent scopes (after scope cleanup, the current scope should
			// not be retained by any of our references and should be eligible for garbage collection)
			if (parent.$$childHead == scope) parent.$$childHead = scope.$$nextSibling;
			if (parent.$$childTail == scope) parent.$$childTail = scope.$$prevSibling;
			if (scope.$$prevSibling) scope.$$prevSibling.$$nextSibling = scope.$$nextSibling;
			if (scope.$$nextSibling) scope.$$nextSibling.$$prevSibling = scope.$$prevSibling;


			// All of the code below is bogus code that works around V8's memory leak via optimized code
			// and inline caches.
			//
			// see:
			// - https://code.google.com/p/v8/issues/detail?id=2073#c26
			// - https://github.com/angular/angular.js/issues/6794#issuecomment-38648909
			// - https://github.com/angular/angular.js/issues/1313#issuecomment-10378451

			scope.$parent = scope.$$nextSibling = scope.$$prevSibling = scope.$$childHead =
				scope.$$childTail = scope.$root = null;

			// don't reset these to null in case some async task tries to register a listener/watch/task
			scope.$$listeners = {};
			scope.$$watchers = scope.$$asyncQueue = scope.$$postDigestQueue = [];

			// prevent NPEs since these methods have references to properties we nulled out
			scope.$destroy = scope.$digest = scope.$apply = angular.noop;
			scope.$on = scope.$watch = function() {
				return angular.noop;
			};
		};
	}

	function decorateDomElement2($scope, $element) {
		$scope.$on('$destroy', function cleanupElementNgGrid() {
			//console.log('GOT A $destroy FROM THE ELEMENT.');
			$timeout(function() {
				addBackDollarDestroy($scope);
				$scope.$destroy();
				$scope.destroyedByForce = true;
				//console.log("I destroyed it.");
			}, 500); // need time for previous broadcasts etc to finish out
		});
	}

	// SERVICE INTERFACE FUNCTIONS ****************************************** //

	// adds a $destroy listener and tweaks the main scope to be memory friendly.
	cleanupService.decorateDirectiveForHeapCleanup = function decorateDirectiveForHeapCleanup($scope, $element, grid) {

		decorateDomElement2($scope,$element);

		// this function was identified as nonuseful per ng grid issue 1164:
		// https://github.com/angular-ui/ng-grid/issues/1164#issuecomment-42481420
		grid.eventProvider.assignEvents = angular.noop;

		$scope.$on('$destroy', function cleanupScopeAndGrid() {

			// cleanup all scope variables that had closure over the internal grid
			// or other key objects

			$scope.adjustScrollLeft = null;
			$scope.adjustScrollTop = null;
			$scope.cantPageBackward = null;
			$scope.cantPageForward = null;
			$scope.cantPageToLast = null;
			$scope.cantPageToLast = null;
			$scope.cantpageBackward = null;
			$scope.canvasStyle = null;
			$scope.domAccessProvider = null;
			$scope.footerStyle = null;
			$scope.groupBy = null;
			$scope.groupPanelStyle = null;
			$scope.headerCellStyle = null;
			$scope.headerScrollerDim = null;
			$scope.headerScrollerStyle = null;
			$scope.headerStyle = null;
			$scope.maxPages = null;
			$scope.maxRows = null;
			$scope.multiSelect = null;
			$scope.pageBackward = null;
			$scope.pageForward = null;
			$scope.pageToFirst = null;
			$scope.pageToLast = null;
			$scope.pagingOptions = null;
			$scope.removeGroup = null;
			$scope.rowStyle = null;
			$scope.selectedItemCount = null;
			$scope.selectionProvider= null;
			$scope.showGroupPanel = null;
			$scope.togglePin = null;
			$scope.toggleSelectAll = null;
			$scope.toggleShowMenu =null;
			$scope.topPanelHeight = null;
			$scope.topPanelStyle = null;
			$scope.totalFilteredItemsLength = null;
			$scope.totalRowWidth = null;
			$scope.viewportDimHeight = null;
			$scope.viewportStyle = null;

			// clean up columsn and rows

			for (var c in $scope.columns) {
				cleanupColumn($scope.columns[c]);
			}
			$scope.columns = null;

			//for (var c in $scope.renderedColumns) {
			//$scope.renderedColumns[c].cleanupColumn();
			//}
			$scope.renderedColumns = null;

			for (var r in $scope.renderedRows) {
				cleanupRow($scope.renderedRows[r]);
			}
			$scope.renderedRows = null;

			// and finally cleanup all objects on the grid iteself.
			cleanupGrid(grid);

		});
	};

	return cleanupService;
}
]);
