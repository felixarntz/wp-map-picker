/*
 * WP Map Picker -  version 0.1.0
 *
 * Felix Arntz <felix-arntz@leaves-and-love.net>
 */

( function( $, google ) {

	if ( typeof google === 'undefined' || typeof google.maps === 'undefined' ) {
		// if google.maps is not loaded, scaffold the jQuery plugin function and abort
		$.fn.wpMapPicker = function() {
			return this;
		};

		console.error( 'Google Maps not found' );
		return;
	}

	var _wrap = '<div class="wp-mappicker-container" />';
	var _canvas_wrap = '<div class="wp-mappicker-map-canvas-wrap" />';
	var _canvas = '<div class="wp-mappicker-map-canvas" />';

	var MapPicker = {
		options: {
			store: 'address',
			zoom: 15,
			draggable: true,
			mapType: 'roadmap', // roadmap, satellite, terrain or hybrid
			default_location: {
				lat: '0.0',
				lng: '0.0',
				zoom: 2
			},
			decimal_separator: '.',
			change: false,
			clear: false
		},

		_create: function() {
			var self = this;

			$.extend( self.options, self.element.data() );

			self.default_latlng = self._parseLatLng( self.options.default_location );
			self.is_default = true;

			self.element.wrap( _wrap );
			self.canvas_wrap = $( _canvas_wrap ).insertAfter( self.element );
			self.canvas = $( _canvas ).appendTo( self.canvas_wrap );

			self.geocoder = new google.maps.Geocoder();

			self.map = new google.maps.Map( self.canvas[0], {
				center: self.default_latlng,
				zoom: self.options.default_location.zoom,
				draggable: self.options.draggable,
				tilt: 0,
				streetViewControl: 0,
				mapTypeId: google.maps.MapTypeId[ self.options.mapType.toUpperCase() ]
			});
			this.marker = new google.maps.Marker({
				position: self.default_latlng,
				map: self.map,
				draggable: true
			});

			self._updateMap();

			self._addListeners();
		},

		_addListeners: function() {
			var self = this;

			if ( 'coords' === self.options.store ) {
				self.element.on( 'change', function() {
					var latlng = self._parseLatLng( self.element.val() );
					if ( latlng ) {
						self._createMap( latlng );
					}
				});
			} else {
				self.element.autocomplete({
					source: function( request, response ) {
						self.geocoder.geocode({
							address: request.term
						}, function( results ) {
							if ( null !== results ) {
								response( $.map( results, function( item ) {
									return {
										label: item.formatted_address,
										value: item.formatted_address,
										latlng: item.geometry.location
									};
								}) );
							} else {
								response( [] );
							}
						});
					},
					select: function( e, ui ) {
						self.element.val( ui.item.label );
						self._createMap( ui.item.latlng );
						if ( 'function' === typeof self.options.change ) {
							self.options.change.call( self );
						}
					}
				});
			}

			google.maps.event.addListener( self.map, 'click', function( e ) {
				self._updateFieldValue( e.latLng );
				self._createMap( e.latLng );
			});

			google.maps.event.addListener( self.marker, 'dragend', function( e ) {
				self._updateFieldValue( e.latLng );
				self._createMap( e.latLng );
			});
		},

		_updateFieldValue: function( latlng, manual_change ) {
			var self = this;

			if ( 'coords' === self.options.store ) {
				self.element.val( self._formatLatLng( latlng ) );

				if ( ! manual_change && 'function' === typeof self.options.change ) {
					self.options.change.call( self );
				}
			} else {
				self.geocoder.geocode({
					location: latlng
				}, function( results ) {
					if ( null !== results && 'undefined' !== typeof results[0] && 'undefined' !== typeof results[0].formatted_address ) {
						self.element.val( results[0].formatted_address );

						if ( ! manual_change && 'function' === typeof self.options.change ) {
							self.options.change.call( self );
						}
					}
				});
			}
		},

		_createMap: function( latlng ) {
			var self = this;

			self.latlng = latlng;

			self.marker.setPosition( latlng );
			self.map.setCenter( latlng );
			if ( self.is_default ) {
				self.is_default = false;
				self.map.setZoom( self.options.zoom );
			}
		},

		_resetMap: function() {
			var self = this;

			self.latlng = null;

			self.marker.setPosition( self.default_latlng );
			self.map.setCenter( self.default_latlng );
			self.map.setZoom( self.options.default_location.zoom );
			self.is_default = true;
		},

		_updateMap: function() {
			var self = this;
			var val = self.element.val();

			if ( val ) {
				if ( 'coords' === self.options.store ) {
					var latlng = self._parseLatLng( val );
					if ( latlng ) {
						self._createMap( latlng );
					} else {
						self.element.val( null );
						self._resetMap();
					}
				} else {
					self.geocoder.geocode({
						address: val
					}, function( results ) {
						if ( null !== results && 'undefined' !== typeof results[0] && 'undefined' !== typeof results[0].geometry && 'undefined' !== typeof results[0].geometry.location ) {
							self._createMap( results[0].geometry.location );
						} else {
							self.element.val( null );
							self._resetMap();
						}
					});
				}
			} else {
				self.element.val( null );
				self._resetMap();
			}
		},

		_parseLatLng: function( val ) {
			var self = this;

			if ( 'object' === typeof val && 'function' !== typeof val.lat ) {
				val = '' + val.lat + '|' + val.lng;
			} else if ( 'object' === typeof val ) {
				return val;
			}

			if ( 'string' !== typeof val ) {
				return false;
			}

			val = val.split( '|' );
			if ( 2 !== val.length ) {
				return false;
			}

			for ( var i = 0; i < 2; i++ ) {
				val[ i ] = parseFloat( val[ i ].replace( self.options.decimal_separator, '.' ) );
			}

			return new google.maps.LatLng( val[0], val[1] );
		},

		_formatLatLng: function( val ) {
			var self = this;

			if ( 'string' === typeof val ) {
				return val;
			}

			return ( '' + val.lat() ).replace( '.', self.options.decimal_separator ) + '|' + ( '' + val.lng() ).replace( '.', self.options.decimal_separator );
		},

		clear: function() {
			this.element.val( null );
			if ( ! this.is_default ) {
				this._resetMap();
				if ( 'function' === typeof this.options.clear ) {
					this.options.clear.call( this );
				}
			}
		},

		refresh: function() {
			google.maps.event.trigger( this.map, 'resize' );
			if ( this.latlng ) {
				this.map.setCenter( this.latlng );
			} else {
				this.map.setCenter( this.default_latlng );
			}
		},

		latlng: function( latlng ) {
			if ( 'undefined' === typeof latlng ) {
				return this.latlng;
			}

			if ( ! latlng ) {
				this.element.val( null );
				this._resetMap();
			} else {
				this._updateFieldValue( latlng, true );
				this._createMap( latlng );
			}
		},

		value: function( val ) {
			if ( 'undefined' === typeof val ) {
				if ( ! this.latlng ) {
					return '';
				}
				return this.element.val();
			}

			this.element.val( val );
			this._updateMap();
		}
	};

	$.widget( 'wp.wpMapPicker', MapPicker );
}( jQuery, google ) );
