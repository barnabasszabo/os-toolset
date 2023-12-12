const path = require(`path`);
const { menubar } = require('menubar');

const mb = menubar({
	index: `https://outlook.office.com/calendar/view/workweek`,
    browserWindow: { height: 1024, width: 1500 }
});

mb.app.dock.hide();

mb.on('ready', () => {
    mb.tray.setImage( path.join(__dirname, 'tray-icon.png') );
});
