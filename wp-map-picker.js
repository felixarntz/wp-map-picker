/*
 * WP Map Picker -  version 0.1.0
 *
 * Felix Arntz <felix-arntz@leaves-and-love.net>
 */

( function( $, google ) {

	if ( typeof $.fn.wpMapPicker !== 'undefined' ) {
		// if the jQuery plugin is already defined, abort
		return;
	}

	if ( typeof google === 'undefined' || typeof google.maps === 'undefined' ) {
		// if google.maps is not loaded, scaffold the jQuery plugin function and abort
		$.fn.wpMapPicker = function() {
			return this;
		};

		console.error( 'Google Maps not found' );
		return;
	}

	function WPMapPicker( $elem, settings ) {
		this.$elem = $elem;
		this.settings = settings;
	}

	WPMapPicker.prototype = {
		init: function() {
			this.canvas = this.$elem.next().find( '.wp-mappicker-map-canvas' )[0];
			this.geocoder = new google.maps.Geocoder();

			var self = this;

			this.initLatLng( function( latlng, is_default ) {
				self.initMap( latlng, is_default );
				self.initEvents();
			});
		},

		initLatLng: function( callback ) {
			var latlng;
			var is_default = false;

			if ( 'coords' === this.settings.store ) {
				latlng = this.parseLatLng( this.value() );
				if ( ! latlng ) {
					latlng = new google.maps.LatLng( this.settings.default_location.lat, this.settings.default_location.lng );
					is_default = true;
				}
				callback( latlng, is_default );
			} else {
				if ( this.value() ) {
					this.geocoder.geocode({
						address: this.value()
					}, function( results ) {
						if ( 'undefined' !== typeof results[0] && 'undefined' !== typeof results[0].geometry && 'undefined' !== typeof results[0].geometry.location ) {
							callback( results[0].geometry.location, false );
						} else {
							latlng = new google.maps.LatLng( this.settings.default_location.lat, this.settings.default_location.lng );
							is_default = true;
							callback( latlng, is_default );
						}
					});
				} else {
					latlng = new google.maps.LatLng( this.settings.default_location.lat, this.settings.default_location.lng );
					is_default = true;
					callback( latlng, is_default );
				}
			}
		},

		initMap: function( latlng, is_default ) {
			this.is_default = is_default;
			this.latlng = latlng;
			this.map = new google.maps.Map( this.canvas, {
				center: this.latlng,
				zoom: this.is_default ? this.settings.default_location.zoom : this.settings.zoom,
				draggable: this.settings.draggable,
				tilt: 0,
				streetViewControl: 0,
				mapTypeId: google.maps.MapTypeId[ this.settings.mapType.toUpperCase() ]
			});
			this.marker = new google.maps.Marker({
				position: this.latlng,
				map: this.map,
				draggable: true
			});
		},

		initEvents: function() {
			var self = this;

			if ( 'coords' === this.settings.store ) {
				this.$elem.on( 'change', function() {
					var latlng = self.parseLatLng( $( this ).val() );
					if ( latlng ) {
						self.latlng = latlng;

						self.marker.setPosition( self.latlng );
						self.map.setCenter( self.latlng );
						if ( self.is_default ) {
							self.is_default = false;
							self.map.setZoom( self.settings.zoom );
						}
					}
				});
			} else {
				this.$elem.autocomplete({
					source: function( request, response ) {
						self.geocoder.geocode({
							address: request.term
						}, function( results ) {
							response( $.map( results, function( item ) {
								return {
									label: item.formatted_address,
									value: item.formatted_address,
									latlng: item.geometry.location
								};
							}) );
						});
					},
					select: function( e, ui ) {
						self.latlng = ui.item.latlng;

						self.marker.setPosition( self.latlng );
						self.map.setCenter( self.latlng );
						if ( self.is_default ) {
							self.is_default = false;
							self.map.setZoom( self.settings.zoom );
						}
					}
				});
			}

			google.maps.event.addListener( this.map, 'click', function( e ) {
				self.latlng = e.latLng;
				self.marker.setPosition( self.latlng );
				if ( self.is_default ) {
					self.is_default = false;
					self.map.setCenter( self.latlng );
					self.map.setZoom( self.settings.zoom );
				}
				self.updateFieldValue();
			});

			google.maps.event.addListener( this.marker, 'dragend', function( e ) {
				self.latlng = e.latLng;
				if ( self.is_default ) {
					self.is_default = false;
					self.map.setCenter( self.latlng );
					self.map.setZoom( self.settings.zoom );
				}
				self.updateFieldValue();
			});
		},

		updateFieldValue: function() {
			if ( 'coords' === this.settings.store ) {
				this.value( this.formatLatLng( this.latlng ) );

				if ( 'function' === typeof this.settings.change ) {
					this.settings.change.call( this );
				}
			} else {
				var self = this;

				this.geocoder.geocode({
					location: this.latlng
				}, function( results ) {
					if ( 'undefined' !== typeof results[0] && 'undefined' !== typeof results[0].formatted_address ) {
						self.value( results[0].formatted_address );

						if ( 'function' === typeof self.settings.change ) {
							self.settings.change.call( self );
						}
					}
				});
			}
		},

		parseLatLng: function( val ) {
			if ( 'object' === typeof val ) {
				return val;
			}

			val = val.split( '|' );
			if ( 2 !== val.length ) {
				return false;
			}

			for ( var i = 0; i < 2; i++ ) {
				val[ i ] = parseFloat( val[ i ].replace( this.settings.decimal_separator, '.' ) );
			}

			return new google.maps.LatLng( val[0], val[1] );
		},

		formatLatLng: function( val ) {
			if ( 'string' === typeof val ) {
				return val;
			}

			return ( '' + val.lat() ).replace( '.', this.settings.decimal_separator ) + '|' + ( '' + val.lng() ).replace( '.', this.settings.decimal_separator );
		},

		value: function( value ) {
			if ( 'undefined' === value ) {
				return this.$elem.val();
			}

			this.$elem.val( value );
		},

		setting: function( key, value ) {
			if ( 'object' === key ) {
				$.extend( this.settings, key );
				return;
			}

			if ( 'undefined' === value ) {
				return this.settings[ key ];
			}

			this.settings[ key ] = value;
		}
	};

	var generateMarkup = function( $elem ) {
		var input_id = $elem.attr( 'id' );

		$elem.after( '<div class="wp-mappicker-map-canvas-wrap"><div data-input-id="' + input_id + '" class="wp-mappicker-map-canvas"></div></div>' );
	};

	/**
	 * Initializes the plugin on one or more fields.
	 *
	 * This is the actual jQuery plugin function.
	 *
	 * In addition to providing settings in the function call, it is also possible to store field-related settings in a field directly.
	 * It has to be valid JSON and it must be stored in a 'data-settings' attribute.
	 *
	 * @param object settings custom settings for the field (all optional)
	 * @return jQuery
	 */
	$.fn.wpMapPicker = function( settings ) {
		if ( $( this ).data( 'wp-map-picker' ) ) {
			var controller = $( this ).data( 'wp-map-picker' );
			var arg;

			if ( 'value' === settings ) {
				arg = Array.prototype.slice.call( arguments, 1 );
				return controller.value( arg );
			} else if ( 'object' === typeof settings ) {
				return controller.setting( settings );
			} else if ( 'string' === typeof settings ) {
				arg = Array.prototype.slice.call( arguments, 1 );
				return controller.setting( settings, arg );
			}

			return;
		}

		settings = $.extend({
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
			change: false
		}, settings || {});

		return this.each( function() {
			var $elem = $( this );
			var elem_settings = $.extend({}, settings );
			var data_settings = $elem.data( 'settings' );

			if ( data_settings ) {
				if ( typeof data_settings === 'string' ) {
					try {
						data_settings = JSON.parse( data_settings );
					} catch ( err ) {
						console.error( err.message );
					}
				}
				if ( typeof data_settings === 'object' ) {
					elem_settings = $.extend( elem_settings, data_settings );
				}
			}

			generateMarkup( $elem );

			var elem_controller = new WPMapPicker( $elem, elem_settings );
			elem_controller.init();

			$elem.data( 'wp-map-picker', elem_controller );
		});
	};
}( jQuery, google ) );
