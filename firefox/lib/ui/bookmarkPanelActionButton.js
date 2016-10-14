var self = require("sdk/self");
var { ActionButton } = require("sdk/ui/button/action");


var actionButton = null;


exports.getActionButton = function(popupPanel, panelWidth, panelHeight) {

	if (actionButton) {
		return actionButton;
	}


	actionButton = ActionButton({
		id: "addonButton",
		label: "Bookmark Box",
		icon: {
			"16": "./img/Bookmark-Box-icon-16.png",
			"32": "./img/Bookmark-Box-icon-32.png",
			"64": "./img/Bookmark-Box-icon-64.png"
		},
		onClick: showPopupPanel
	});

	function showPopupPanel(state) {

		if (popupPanel) {
			if (!popupPanel.isPanelVisible()) {
				popupPanel.showPanel(actionButton, panelHeight, panelWidth);
			} else {
				popupPanel.hidePanel();
			}
		}

	}


	return actionButton;
}