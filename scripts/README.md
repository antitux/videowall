# Helper Scripts

## Description

These are helper scripts to allow you to run firefox in kiosk mode on Ubuntu Desktop. This gives the system the ability to force restart the browser on a timed schedule and also reload the browser remotely. This also enables marionette for firefox to be able to connect and remotely automate tasks.

## Instructions

### 1. Install Dex
This reads .desktop files and runs them.

```
sudo apt-get install dex -y
```

### 2. Install Firefox from the official repository
Directions here: https://support.mozilla.org/en-US/kb/install-firefox-linux

### 3. Install the desktop autostart files

- Copy files into place:
```
# Create autostart directory
mkdir -p ~/.config/autostart

# Copy the autostart .desktop files into place
cp scripts/firefox.desktop ~/.config/autostart
cp scripts/xhost.desktop ~/.config/autostart
```
- **NOTE: If you're using a local instance, update the url in the `firefox.desktop` file**
- Log out of your desktop session and log back in.


### 4. Install the helper scripts
```
mkdir -p ~/.config/bin
cp scripts/firefox_desktop_restart.sh ~/.config/bin
cp scripts/firefox_reload.py ~/.config/bin

# Set Executable
chmod 755 ~/.config/bin/firefox*
```

### 5. Create cron jobs

- From the terminal, run `crontab -e`
- Copy the following lines into your crontab:

```
*/30 * * * * /usr/bin/python3 ~/.config/bin/firefox_reload.py
0 0 * * * * ~/.config/bin/firefox_desktop_restart.sh
```
- Adjust your crontab to your liking.
    - I prefer to restart my firefox browser once per day and force a full cache refresh of my browser once every 30 minutes.
    - For more information, run `man 5 crontab` at the terminal.