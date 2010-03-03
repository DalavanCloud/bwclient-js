/**
 * @author    Ian Paterson
 * @namespace botoweb.ui.widget.editing_tools
 */

/**
 * Displays object editing links based on the actions available to the user.
 *
 * @param node where to insert the icons.
 */
botoweb.ui.widget.AttributeList = function(node, model, obj) {
	var self = this;

	self.node = $(node).addClass('widget-attribute_list clear').attr(botoweb.ui.markup.prop.widget, '');
	self.template = $('<div/>').append(self.node.contents().clone()).addClass('template');
	self.node.empty();
	self.model = model;
	self.properties = [];
	self.sequence = self.node.attr(botoweb.ui.markup.prop.attributes);
	self.existing_only = self.node.attr(botoweb.ui.markup.prop.existing_only) || '';
	self.existing_only = self.existing_only.split(',');

	if (self.sequence && self.sequence != 'all')
		self.sequence = self.sequence.split(',')
	else
		self.sequence = $.map(self.model.properties, function(prop) { return prop.name });

	self.properties = $.map(self.sequence, function(name, num) {
		if (!name) {
			return {_label: '&nbsp;'};
		}
		var n = name.replace(/\..*/, '');
		if (!(n in self.model.prop_map))
			return;

		var props = {};

		for (i in self.model.prop_map[n])
			props[i] = self.model.prop_map[n][i];

		if (props._perm && $.inArray('read', props._perm) == -1)
			return;

		if (n != name) {
			props.name = name;
		}

		//if (!obj.properties[props.name])
		//	return;

		return props;
	});

	/*if (self.properties.length > 20) {
		self.per_column = Math.ceil(self.properties.length / 3);
		self.columns = [
			$('<div/>')
				.addClass('al p33')
				.appendTo(self.node),
			$('<div/>')
				.addClass('al p33')
				.appendTo(self.node),
			$('<div/>')
				.addClass('al p33')
				.appendTo(self.node)
		]
	}
	else if (self.properties.length > 5) {*/
		self.per_column = Math.ceil(self.properties.length / 2);
		self.columns = [
			$('<div/>')
				.addClass('al p50')
				.appendTo(self.node),
			$('<div/>')
				.addClass('al p50')
				.appendTo(self.node)
		]
	/*}
	else {
		self.per_column = 1e99;
		self.columns = [
			$('<div/>')
				.appendTo(self.node)
		]
	}*/

	$(self.properties).each(function(num, props) {
		var c = self.columns[Math.floor(num / self.per_column)];

		var template = self.template.find(botoweb.ui.markup.sel.attribute.replace(']', '=' + props.name + ']'));
		var label = self.template.find('label[for=' + props.name + ']:first');

		if (template.length) {
			// Ignore nested attributes, these may belong to different objects via references
			if (template.parents(botoweb.ui.markup.sel.attribute).length)
				template = {};
			else
				var t = template.parent('*:not(.template):last');
				if (t.length)
					template = t;
		}

		if (!label.length)
			label = null;

		var container = $('<div/>')
			.addClass('property');

		if (template.length)
			container.append(template.clone());
		else if (props._type in {list:1,query:1,reference:1}) {
			var field = $('<div/>').attr(botoweb.ui.markup.prop.attribute, props.name);

			if ($.inArray(props.name, self.existing_only) >= 0)
				field.attr(botoweb.ui.markup.prop.existing_only, 'true');

			container.append(field);
		}
		else
			container.attr(botoweb.ui.markup.prop.attribute, props.name);

		c.append(
			$('<div/>')
				.addClass('row ' + (((num % self.per_column) % 2) ? 'odd' : 'even'))
				.append(
					(label || $('<label/>')
						.addClass('property_label')
						.html(props._label + ' &nbsp; ')),
					container,
					$('<br class="clear"/>')
				)
		);
	});
};
