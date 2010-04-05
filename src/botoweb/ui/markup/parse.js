/**
 * A library of botoweb markup parsers
 *
 * @author Ian Paterson
 */

(function ($) {
	botoweb.ui.markup.parse = {
		/**
		 * Parse conditional tags and remove them from the block.node if the
		 * corresponding condition function returns false.
		 */
		condition: function (block) {
			var matches = false;

			$markup.find(block.node, 'condition', function (val, prop) {
				matches = true;

				this.removeAttr(prop);

				if (val in botoweb.env.cfg.conditions){
					if(botoweb.env.cfg.conditions[val](block.obj, this) === false)
						this.remove();
				}
				else
					botoweb.util.error('UI condition does not exist: ' + val);
			});

			return matches;
		},

		/**
		 * Parse triggers and execute them.
		 */
		trigger: function (block) {
			var matches = false;

			$markup.find(block.node, 'trigger', function (val, prop) {
				matches = true;

				if (val in botoweb.env.cfg.triggers)
					botoweb.env.cfg.triggers[val](block.obj, this);
				else
					this.removeAttr(prop);
			});

			return matches;
		},

		/**
		 * Parses forms which are enhanced with botoweb markup.
		 */
		action: function (block) {
			var matches = false;

			$markup.find(block.node, 'action', function(val, prop) {
				matches = true;

				var model = this.attr($markup.prop.model);

				if (model)
					model = botoweb.env.models[model];

				if (!model) {
					this.remove();
					return;
				}

				// Additional data may be included in parens after the link type
				/()/.test(''); // reset RegExp backrefs
				val = val.replace(/\((.*?)\)/, '');
				var data = RegExp.$1;

				if (block.obj)
					data = $util.interpolate(data, block.obj);
				else if (block.model)
					data = $util.interpolate(data, block.model);
				else
					data = $util.interpolate(data);

				this.removeAttr(prop);

				var b = new $markup.Block(this);

				try {
					eval('data = ' + data);

					for (var prop in data) {
						b.fields.push($forms.prop_field(new model.prop_map[prop].instance(), {
							block: b,
							def: data[prop]
						}));
					}
				} catch (e) {}

				$(b).trigger('edit');

				botoweb.ui.button('Create ' + model.name)
					.click(function (e) {
						b.save(function () {
							botoweb.ui.page.refresh();
						});

						e.preventDefault();

						return false;
					})
					.appendTo(this);

				botoweb.ui.button('Reset', { primary: false })
					.click(function (e) {
						$(b).trigger('edit');

						e.preventDefault();

						return false;
					})
					.appendTo(this);
			});

			return matches;
		},

		/**
		 * Parse attributes.
		 */
		attribute: function (block) {
			var matches = false;

			if (!block.model && !block.obj)
				return;

			var still_matches;

			do {
				still_matches = false;

				$markup.find(block.node, 'attribute', function(val, prop) {
					still_matches = matches = true;

					val = /^([^.]*)\.?(.*)$/.exec(val);

					var follow_props = val[2];
					val = val[1];

					this.removeAttr(prop);

					// Special cases
					if (val == 'id')
						return this.html(block.obj.id);
					else if (val == 'model')
						return this.html(block.obj.model.name);

					// If the property is not supported, empty the container to
					// prevent anything inside from being parsed according to
					// the current object when it was intended for a referenced
					// object
					if (!(val in block.model.prop_map)) {
						this.empty();
						return;
					}

					var editable = this.parents($markup.sel.editable + ':first').attr($markup.prop.editable);

					if (editable === undefined)
						editable = block.opt.editable
					else
						editable = (editable == 'false' || editable === false) ? false : true;

					var node = this;
					var contents;
					var prop = block.model.prop_map[val];

					if (prop.is_type('reference', 'query')) {
						if (follow_props) {
							this.append($('<span/>')
								.attr(prop, follow_props));
						}

						if (this.find($markup.sel.attribute).length == 0) {
							this.append('<a bwAttribute="name" bwLink="view"/>');
						}

						contents = this.contents().clone();
						this.empty();

						function descend (obj) {
							if (obj && obj.id) {
								var b = new botoweb.ui.markup.Block($('<div/>').append(contents.clone()), { obj: obj, editable: ((editable) ? 'true' : 'false'), parent: block });
								block.children.push(b);

								node.append(b.node.contents());
							}
						}

						if (block.obj) {
							block.waiting++;

							var async = false;

							block.obj.data[val].val(function (data) {
								$.each(data, function () {
									if (this && this.val)
										descend(this.val);
								});

								block.waiting--;

								if (async && !block.waiting)
									block.done();
							});

							async = true;
						}
						else {
							descend();
						}
					}

					else if (prop.is_type('list')) {
						if (block.obj) {
							block.waiting++;
							var async = false;

							block.obj.data[val].val(function (data) {
								if (data.length && (data.length > 1 || data[0].val)) {
									if (node.is('li')) {
										var items = block.obj.data[val].toString(true);
										$.each(items, function () {
											node.after(node.clone().html('' + this));
										});
									}
									else {
										var str = block.obj.data[val].toString();

										if (str)
											node.html(str);

										node.show();
									}
								}

								block.waiting--;

								if (async && !block.waiting)
									block.done();
							});

							node.hide();

							async = true;
						}
					}

					else if (block.obj && prop.is_type('blob')) {
						block.obj.load(val, function (data) {
							if (!data) return;

							node.html(botoweb.util.html_format(data));
						});
					}

					else if (block.obj && prop.is_type('dateTime')) {
						var ts = block.obj.data[val].val();
						var html = '';

						if (ts && ts.length)
							html += '<span class="hidden">' + ts[0].val + '</span>';

						// Insert raw timestamp for sorting
						this.html(html + block.obj.data[val].toString());
					}

					else if (block.obj && val in block.obj.data) {
						this.html(block.obj.data[val].toString() || '');
					}

					if (editable && prop.meta.write) {
						var opt = {
							node: this,
							block: block,
							model: block.model
						};

						if (prop.is_type('reference','query') && contents.find($markup.sel.attribute).length) {
							opt.template = contents;
						}

						if (block.obj && val in block.obj.data)
							prop = block.obj.data[val];

						block.fields.push($forms.prop_field(prop, opt));
					}
				}, {
					suffix: ':first'
				});
			}
			while (still_matches);

			return matches;
		},

		/**
		 * Parse nodes which are marked for hyperlinking. Links may transfer the
		 * user to a different page, open an external address, or just add a
		 * click event to the linked node. Links will be generated regardless of
		 * permissions, so the handler of the link should provide an alert when
		 * the user does not have appropriate permissions.
		 *
		 * The delete action does not have an associated link and must be
		 * handled with a click event. This is to prevent any accidental
		 * deletion by sharing links or clicking Back.
		 */
		link: function (block) {
			var matches = false;

			if (!block.model && !block.obj)
				return;

			$markup.find(block.node, 'link', function(val, prop) {
				matches = true;

				this.removeAttr(prop);

				// Additional data may be included in parens after the link type
				/()/.test(''); // reset RegExp backrefs
				val = val.replace(/\((.*?)\)/, '');
				var data = RegExp.$1;

				// It is safest not to make a history entry for deletes, just
				// attach a click event.
				if (val == 'delete')
					return;

				// Without an object, the only supported link type is create
				if (val != 'create' && !block.obj)
					return;

				var set_href;
				var node = this;

				// Use a click event on a button to simulate an anchor href
				if (this.is('button')) {
					set_href = function (href) {
						node.click(function () {
							if (href.charAt(0) == '#')
								document.location.href = botoweb.ui.page.location.href + href;
							else
								document.location.href = href;
						});
					};
				}
				else {
					set_href = function (href) {
						node.attr('href', href);
					};

					// Default href is just for show - will either be replaced or
					// overridden with a bound event.
					this.attr('href', '#' + val);
				}

				var view_href = '';

				if (block.obj)
					view_href = '#' + botoweb.util.interpolate(botoweb.env.cfg.templates.model, block.model) + '?id=' + escape(block.obj.id);

				switch (val) {
					case 'update':
					case 'edit':
						if (data) {
							this.bind('click', function () {
								// TODO save editing info

								return false;
							});
						}
						else
							set_href(view_href + '&action=edit');
						break;

					case 'clone':
						set_href(view_href + '&action=clone');
						break;

					case 'create':
						if (block.model.name in botoweb.env.cfg.templates.editor)
							set_href('#' + botoweb.env.cfg.templates.editor[block.model.name] + '&action=create');
						else
							set_href('#' + botoweb.util.interpolate(botoweb.env.cfg.templates.model, block.model) + '&action=create');
						break;

					case 'attr':
						if (data in block.model.prop_map) {
							var href = block.obj.data[data].val();
							var num_choices = 0;

							if (href && href.length) {
								num_choices = href.length;
								href = href[0].val;
							}

							var text = this.text();

							// Convert emails to mailto: links
							if (href && href.indexOf('@') >= 0) {
								if (num_choices > 1 && text && text.indexOf('@') >= 0)
									href = botoweb.env.cfg.format.email_href.call(this, text, val, block.obj);
								else
									href = botoweb.env.cfg.format.email_href.call(this, href, val, block.obj);

								set_href(href);
							}

							// If the property is itself a link, ensure that it
							// includes a protocol and use it as the href
							else if (href && /(:\/\/|www\.|\.com)/.test(href)) {
								if (RegExp.$1 != '://')
									href = 'http://' + href;

								if (num_choices > 1 && text && text.indexOf('://') >= 0)
									href = botoweb.env.cfg.format.external_href.call(this, text, val, block.obj);
								else
									href = botoweb.env.cfg.format.external_href.call(this, href, val, block.obj);

								set_href(href);
							}

							// Otherwise, link to the botoweb page which will
							// display the content of the attribute
							else
								set_href(botoweb.util.url_join(botoweb.env.cfg.base_url, block.model.href, block.obj.id, data));
						}
						break;

					default:
						set_href(view_href);
						break;
				}
			});

			return matches;
		},

		/**
		 * Parse attribute lists.
		 */
		attribute_list: function (block) {
			var matches = false;

			if (!block.model && !block.obj)
				return;

			$markup.find(block.node, 'attribute_list', function(val, prop) {
				matches = true;

				this.removeAttr(prop);

				new botoweb.ui.widget.AttributeList(this, block.model, block.obj);
			}, {
				// AttributeLists nested in attributes will be processed later
				suffix: ':not(' + $markup.sel.attribute + ' ' + $markup.sel.attribute_list + ')'
			});

			return matches;
		},

		/**
		 * Parse relation blocks.
		 */
		relation: function (block) {
			var matches = false;

			if (!block.obj)
				return;

			$markup.find(block.node, 'relation', function(val, prop) {
				matches = true;

				this.removeAttr(prop);

				val = this.attr($markup.prop.attributes);

				var results = new botoweb.ui.widget.SearchResults(this, block.model);

				block.obj.follow(val, function (data, page, count) {
					results.update(data, page, count);
				});
			});

			return matches;
		},

		/**
		 * Add editing tools for models and objects.
		 */
		editing_tools: function (block) {
			var matches = false;

			if (!block.model && !block.obj)
				return;

			$markup.find(block.node, 'editing_tools', function() {
				matches = true;
				new botoweb.ui.widget.EditingTools(this, block, (this.attr($markup.prop.attributes) || ''), block);
			});

			return matches;
		},

		/**
		 * Parse search blocks.
		 */
		search: function (block) {
			var matches = false;

			$markup.find(block.node, 'search', function() {
				matches = true;

				new botoweb.ui.widget.Search(this);
			});

			return matches;
		},

		/**
		 * Parse search result blocks.
		 */
		search_results: function (block) {
			var matches = false;

			$markup.find(block.node, 'search_results', function() {
				matches = true;
				new botoweb.ui.widget.SearchResults(this, block.model);
			});

			return matches;
		}
	};

	var $markup = botoweb.ui.markup;
	var $forms = botoweb.ui.forms;
	var $util = botoweb.util;
})(jQuery);