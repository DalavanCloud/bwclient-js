/**
 * Provides support for numerous native and non-native form elements.
 *
 * @author Ian Paterson
 */

(function ($) {

var $util = botoweb.util;
var $ui = botoweb.ui;
var $forms = $ui.forms;

$forms.prop_field = function (prop, opt) {
	opt = opt || {};

	if (prop.is_type('text') || opt.input == 'textarea' || prop.meta.maxlength > 1024)
		return new $forms.Textarea(prop, opt);
	else if (prop.meta.choices)
		return new $forms.Dropdown(prop, opt);
	else if (prop.is_type('string') || opt.input == 'text')
		return new $forms.Text(prop, opt);
	else if (prop.is_type('dateTime') || opt.input == 'dateTime')
		return new $forms.DateTime(prop, opt);
	else if (prop.is_type('reference'))
		return new $forms.Picklist(prop, opt);
	else if (prop.is_type('boolean'))
		return new $forms.Bool(prop, opt);
	else if (prop.is_type('password') || opt.input == 'password')
		return new $forms.Password(prop, opt);
	else if (prop.is_type('blob') || opt.input == 'file')
		return new $forms.File(prop, opt);
	else if (prop.is_type('complexType'))
		return new $forms.Mapping(prop, opt);
	else
		return new $forms.Text(prop, opt);
};

/**
 * Base abstract class for all form field types.
 *
 * @constructor
 */
$forms.Field = function (prop, opt) {
	var self = this;

	this.node = $('<div class="prop_editor"/>').hide();

	if (prop) {
		this.prop = prop;
		this.obj = prop.obj;
		this.model = prop.meta.model;
	}

	this.opt = $.extend(true, {
		allow_list: true,
		html: {
			tagName: 'input',
			attr: {}
		},
		choices: []
	}, opt);

	this.template = this.opt.template;
	this.fields = [];
	this.editing = false;

	/**
	 * If the field is included in a larger editing operation it is not
	 * atomic. Otherwise, committing an update to the field will update just
	 * that property of the object.
	 */
	this.atomic = false

	if (this.opt.node) {
		this.node.insertAfter(this.opt.node);

		this.opt.node.dblclick(function () {
			self.edit(true);
		});
	}

	/**
	 * For fields such as dropdowns which have multiple choices, this method
	 * adds those choices. If the field is in editing mode, it also updates
	 * the UI with the new choices.
	 *
	 * @param {[Object]} choices An array of objects with the keys text and
	 * value.
	 * @param {Boolean} replace If true, existing choices will be removed.
	 */
	this.add_choices = function (choices, replace) {
		if (replace)
			this.opt.choices = choices;
		else
			$.merge(this.opt.choices, choices);

		if (editing) {
			// Must be defined in subclass
			this.reset_choices();
		}
	};

	/**
	 * Expands the form by adding another field or templated editor to allow
	 * input of multiple values. Generally this is only used on properties
	 * of type list, but since it can also be used to select multiple values
	 * for filtering a single-value property, this method is agnostic of the
	 * property type.
	 */
	this.add_field = function (value) {
		var field = this.build_field(value);

		if (this.prop && this.prop.is_type('list') && this.opt.allow_list) {
			var node = $('<li class="sortable_item clear"/>').append(field);

			node.hide();
			setTimeout(function () {
				field.css('width', self.node.width() - 42);
				$ui.sort_icons(self.node.find('ul'));
				node.show();
			}, 50);

			this.node.find('ul').append(node);

			field.addClass('al');

			field.before($('<span class="ui-icon"/>'));
			field.after(
				$ui.button('', { icon: 'ui-icon-close', no_text: true, corners: [0,1,1,0], primary: false })
					.attr('tabindex', -1)
					.click(function () {
						if (self.node.find('li').length == 1)
							self.add_field();

						setTimeout(function () {
							node.remove();

							$ui.sort_icons(self.node.find('ul'));
						}, 50);
					}),
				$('<br class="clear"/>')
			);
		}
		else {
			field.hide();
			setTimeout(function () {
				field.css('width', self.node.width() - 4);
				field.show();
			}, 50);

			if (this.fields.length) {
				this.fields[this.fields.length - 1].after(field);
				field.before($('<br class="clear"/>'));
			}
			else
				this.node.append(field);
		}

		if ('decorate_field' in this)
			this.decorate_field(field);

		field.focus();

		this.fields.push(field);
	};

	/**
	 * Switches the form to editing mode. When the mode is switched, we
	 * generate a fresh UI for editing the item. This facilitates canceling
	 * changes and incorporating any updates to the data since the editing
	 * fields were constructed.
	 */
	this.edit = function (atomic) {
		this.atomic = atomic;
		this.node.empty();

		if (this.prop.is_type('list') && this.opt.allow_list)
			this.node.append($ui.sortable($('<ul class="clear"/>')));

		var val = this.prop.val();

		if (val.length) {
			$.each(val, function () {
				self.add_field(this);
			});
		}
		else
			self.add_field();

		if (this.prop.is_type('list') && this.opt.allow_list) {
			this.node.prepend(
				$ui.button('Add item', { icon: 'ui-icon-arrowthick-1-s', corners: [1,1,0,0] })
					.addClass('small add_selection')
					.click(function () {
						self.add_field();
						return false;
					})
			);
		}

		if (this.atomic) {
			var $styles = botoweb.env.cfg.styles;

			this.node.append(
				$('<br class="clear"/>'),
				$('<p/>').append(
					$ui.button('Save', '', true)
						.addClass('small')
						.click(function () {
							// TODO save atomic update
							return false;
						}),
					$ui.button('Cancel', '', false)
						.addClass('small')
						.click(function () {
							self.cancel();
							return false;
						})
				)
			);
		}

		this.set_default();

		this.opt.node.hide();

		this.node.show();

		return this;
	};

	this.cancel = function () {
		this.fields = [];
		this.node.empty();
		this.node.hide();
		this.opt.node.show();
	}

	this.set_default = function () {
		$.each(this.fields, function () {
			if (!$(this).val())
				$(this).val(self.prop.meta.def);
		});
	}

	/**
	 * Switches the form to editing mode. When the mode is switched, we
	 * generate a fresh UI for editing the item. This facilitates canceling
	 * changes and incorporating any updates to the data since the editing
	 * fields were constructed.
	 */
	this.commit = function () {
		if (this.atomic) {
			var data = {};
			data[this.prop.name] = this.val();
			this.obj.update(data);
		}

		// Reset the property to view mode
		this.cancel();
	};

	/**
	 * Switches the form to editing mode. When the mode is switched, we
	 * generate a fresh UI for editing the item. This facilitates canceling
	 * changes and incorporating any updates to the data since the editing
	 * fields were constructed.
	 */
	this.cancel = function () {
		this.node.hide();
		this.opt.node.show();

		this.node.empty();
		this.fields = [];
	};

	/**
	 * Updates the choices in the UI to the current value of
	 * this.opt.choices.
	 *
	 * Implementation will vary based on the UI component, must be
	 * overridden.
	 */
	this.reset_choices = function () { };

	/**
	 * Generates the initial state of the editing field.
	 *
	 * Implementation may vary based on the UI component, this will handle
	 * basic form fields but should be overridden for more complex
	 * interfaces.
	 */
	this.build_field = function (value) {
		if (value)
			value = $util.html_unescape(value.val);
		else
			value = '';

		var field = $('<' + this.opt.html.tagName + '/>')
			.attr(this.opt.html.attr);

		// If the field supports choices this will add them
		this.reset_choices(field);

		field.val(value);

		return field;
	};

	if (this.obj) {
		$(this.obj).bind('edit', function () {
			self.edit();
		});
	}
};

$forms.Text = function () {
	$forms.Field.apply(this, arguments);

	this.opt.html.attr.type = 'text';
};

$forms.Textarea = function () {
	$forms.Field.apply(this, arguments);

	this.opt.html.tagName = 'textarea';
};

$forms.DateTime = function () {
	$forms.Field.apply(this, arguments);

	this.opt.html.attr.type = 'text';

	this.decorate_field = function (field) {
		field.datepicker({
			showAnim: 'drop',
			showOptions: {direction: 'down', duration: 250}
		});
	};
};

$forms.Password = function () {
	$forms.Field.apply(this, arguments);

	this.opt.html.attr.type = 'password';
};

$forms.Dropdown = function () {
	$forms.Field.apply(this, arguments);

	this.opt.html.tagName = 'select';

	/**
	 * Updates the choices in the UI to the current value of
	 * this.opt.choices.
	 */
	this.reset_choices = function (field) {
		var self = this;

		function reset_choices () {
			var field = $(this);
			field.empty();

			field.append($('<option/>'));

			$.each(self.prop.meta.choices, function () {
				if (this.name || this.value)
					field.append($('<option/>').text(this.name || this.value).val(this.value));
			});
		}

		if (field)
			reset_choices.call(field);
		else
			$.each(this.fields, reset_choices);
	};
};

$forms.Bool = function () {
	$forms.Field.apply(this, arguments);

	this.build_field = function (value) {
		value = value.val;

		var field = $('<div><div class="al"><input type="radio" value="1"/> Yes &nbsp; <input type="radio" value="0"/> No &nbsp; </div></div>');



		field.append(
			$ui.button('Clear')
				.addClass('small')
				.click(function () {
					field.find('input').attr('checked', false);
				})
		);

		// If the field supports choices this will add them
		this.reset_choices(field);

		field.find('input').attr({
			checked: false,
			// Random name just to make sure these function as radio buttons
			name: 'field_' + Math.round(Math.random() * 10000)
		});

		if (value !== null)
			field.find('input[value=' + value + ']').attr('checked', true);

		return field;
	};
};

$forms.File = function () {
	$forms.Field.apply(this, arguments);

	//this.build_field = function () {

	//};
};

$forms.Mapping = function () {
	$forms.Field.apply(this, arguments);

	//this.build_field = function () {

	//};
};

$forms.Picklist = function () {
	$forms.Field.apply(this, arguments);

	var self = this;

	// The form will manage list behavior itself.
	this.opt.allow_list = false;

	this.model = botoweb.env.models[this.prop.meta.item_type];

	this.build_field = function (value) {
		var field = $('<div class="ui-picklist"><div class="selections"></div><div class="search clear"></div></div>');
		var selections = field.find('.selections:first');
		var search = field.find('.search:first');
		var search_results = $ui.nodes.search_results;

		var search_field = new $forms.Text();

		var selecting = false;
		var autosearch;
		var prev_value;

		search_field.add_field();

		var search_box = search_field.fields[0];

		field.hide();
		setTimeout(function () {
			search_box.css('width', self.node.width() - 30);
			field.show();
		}, 50);

		function navigate_results (e) {
			if (e.keyCode == 13) {
				add_selection(search_results.find('button.ui-state-highlight').attr('id'));
				return;
			}

			if (e.keyCode != 40 && e.keyCode != 38)
				return;

			var current = search_results.find('button.ui-state-highlight');

			var target;

			if (e.keyCode == 40)
				target = current.next().addClass('ui-state-highlight');
			else
				target = current.prev().addClass('ui-state-highlight');

			if (target.length) {
				var position = target.position();

				search_results.stop();
				search_results.scrollTo(target, 250, {offset: -60});

				current.removeClass('ui-state-highlight');
			}
		}

		function cancel_search (clear_value) {
			selecting = false;
			search_results.hide();
			search_box.unbind('keyup', navigate_results);

			if (clear_value)
				search_box.val('');
		}

		function add_selection (id) {
			// Don't add if already selected
			if (selections.find('#' + id).length == 0) {
				if (!self.prop.is_type('list'))
					selections.empty();

				self.model.get(id, function (obj) {
					if (obj) {
						selections.append(
							$('<div class="selection"/>')
								.attr('id', obj.id)
								.attr($ui.markup.prop.model, obj.model.name)
								.text(' ' + obj.data.name.toString())
								.prepend(
									$ui.button('', { icon: 'ui-icon-close', no_text: true, mini: true, primary: false })
										.addClass('ui-state-error')
										.click(function () {
											$(this).parent().remove();
										})
								)
						);
					}
				});
			}

			cancel_search(true);
		}

		function do_search() {
			self.model.query([['name', 'like', '%' + search_box.val() + '%']], function (objs) {
				search_results.hide();
				selecting = true;

				// Reposition the search results
				var offset = search.offset();
				var results_offset = search_results.offset();
				var w = search_box.width();
				var h = search_box.height();

				var result_node = search_results.find('.search_results').empty();
				var items = [];

				if (objs.length == 0) {
					result_node.html('<div class="jc"><strong>No results found</strong></div>');
				}
				else {
					// Get the string form of each object
					$.each(objs, function () {
						items.push({ id: this.id, text: this.data.name.toString(), model: this.model.name });
					});

					// Sort alphabetically, ignoring a, an, and the
					items = items.sort(function (a, b) {
						return (a.text.toLowerCase().replace(/^\s*((the|a|an)\s+)?/, '') > b.text.toLowerCase().replace(/^\s+(the |a |an )?/, '')) ? 1 : -1;
					});

					$.each(items, function (i, obj) {
						result_node.append(
							$ui.button('<div class="ar small">' + obj.model + '</div>' + obj.text, { corners: [0,0,0,0] })
								.attr('id', obj.id)
								.click(function () {
									add_selection(obj.id);
								})
						);
					});

					result_node.find('*:first').addClass('ui-state-highlight');
				}

				search_box.keyup(navigate_results);

				var new_h = (objs.length || 1) * 20;

				if (results_offset.left != offset.left || results_offset.top != offset.top + h) {
					search_results.css({
						left: offset.left + 1 + 'px',
						top: offset.top + h + 1 + 'px',
						width: w - 4 + 'px',
						height: ((new_h > 200) ? 200 : new_h) + 'px'
					});

					if (new_h > 200)
						result_node.css('padding-right', '15px');

					search_results.slideDown(function () {
						if (new_h > 200)
							result_node.css('padding-right', '');
					});
				}

				search_results.show();
			});
		}

		search.append(
			search_box
				.addClass('al')
				.keyup(function (e) {
					if (e.keyCode == 40 && !selecting)
						do_search();
					else if (e.keyCode) {
						clearTimeout(autosearch);

						if (this.value == '' && !selecting)
							cancel_search();
						else if (this.value != prev_value) {
							cancel_search();
							autosearch = setTimeout(do_search, 750);
						}
					}

					prev_value = this.value;
				}),
			$ui.button('', { icon: 'ui-icon-search', no_text: true, corners: [0,1,1,0] })
				.click(do_search)
		);

		this.prop.val(function (refs) {
			$.each(refs, function () {
				if (this)
					add_selection(this.id);
			});
		})

		return field
	};
};

})(jQuery);