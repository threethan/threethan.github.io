var webusb = null;
var adb = null;
var fastboot = null;
var shell = null;
var sync = null;

var state = "ready";

var last_output = "";
function output(msg) {
    last_output = msg;
    console.log(msg);
    showExecuteOutputs(msg);
}
function get_device_name() {
    if (webusb != null && webusb.device != null)
        return webusb.device.productName;
    return "headset";
}
function installation_complete() {
    setSectionTo(3);
}

async function disconnect_usb()
{
	if (shell != null)
		shell.close();
	if (sync != null)
		await sync.abort();
	webusb.close();
	webusb = null;
}

async function connect_usb()
{
	try {
		if (webusb != null) {
			state = "disconnecting";
			disconnect_usb();
			state = "ready";
			return connect_usb();
		} else {
			state = "connecting";
			webusb = await Adb.open("WebUSB");
		}

		if (!webusb || !(webusb.isAdb() || webusb.isFastboot()))
			throw new Error("Could not open either ADB or Fastboot");
	}
	catch(error) {
        state = "ready";
		webusb = null;
        if (error.message.includes("No device selected")) {
            connect_no_device_selected();
        } else {
			connect_error();
        }
		console.log(error);

		return;
	}

	if (webusb.isFastboot()) {
		this.connect_message("Please reboot your " + webusb.device.productName + " normally.");
	}

    connect_adb()
}
async function connect_adb(retry = true) {
    try {
        adb = null;
        adb = await webusb.connectAdb("host::", () => connect_click_allow());

        if (adb != null) {
            console.log("ADB mode");
            state = "connected";
            await execute_cmd("shell:echo Test ADB connection successful.");
            // this.stat_filename("/sdcard/Download/test_webadb.txt");
            // this.pull_filename("/sdcard/Download/test_webadb.txt");
            // this.push_dest("/sdcard/Download/test_webadb.txt");
            // this.push_mode("0644");
            connect_message("Connected to " + webusb.device.productName + " in ADB mode.");
            connection_established();
        }
    }
    catch(error) {
        console.log(error);

        if (retry) {
            this.connect_error();
            // Wait 1s and retry (won't work, but makes next try more likely to succeed)
            await new Promise(r => setTimeout(r, 1000));
            connect_adb(false);
        } else {
            state = "ready";
            adb = null;
            webusb = null;
        }
    }
}

async function execute_cmd(cmd)
{
	// let output = this.execute_output;
	let decoder = new TextDecoder();

    let r = null;

    connect_message("Executing: " + cmd);

	try {
		if (adb != null ) {
			state = "running";

			shell = await adb.open(cmd);
			r = await shell.receive();
			while (r.cmd == "WRTE") {
				if (r.data != null) {
					output(decoder.decode(r.data));
				}

				shell.send("OKAY");
				r = await shell.receive();
			}

			shell.close();
			shell = null;
			state = "connected";
		} else {
            connection_lost();
        }
	}
	catch(error) {
        connection_lost();
		console.log(error);
		this.connect_message(error.message);
		state = "ready";
		webusb = null;
	}
}

// async function stat_usb()
// {
// 	let output = this.execute_output;

// 	try {
// 		if (adb != null ) {
// 			state = "running";
// 			output("");

// 			sync = await adb.sync();
// 			let stat = await sync.stat(this.stat_filename());
// 			output(JSON.stringify(stat));

// 			await sync.quit();
// 			sync = null;
// 			this.state("connected");
// 		}
// 	}
// 	catch(error) {
// 		console.log(error);
// 		this.connect_message(error.message);
// 		this.state("ready");
// 		webusb = null;
// 	}
// }

// async function pull_usb()
// {
// 	let output = this.execute_output;
// 	let bottom = document.getElementById('bottom');

// 	try {
// 		if (adb != null ) {
// 			state = "running";
// 			output("");

// 			sync = await adb.sync();
// 			let content = await sync.pull(this.pull_filename());

// 			await sync.quit();
// 			sync = null;
// 			state = "connected";

// 			let a = document.createElement("a")
// 			a.href = URL.createObjectURL(new Blob([content]));
// 			a.download = this.pull_filename().split("/").pop();
// 			a.click();
// 		}
// 	}
// 	catch(error) {
// 		console.log(error);
// 		output(error.message);
// 		state = "connected";
// 	}
// }

var xfer_stats_done = 0;
var xfer_stats_time = 0;

function xfer_stats(start_time, done, total)
{
	let now = Date.now();

	if (now - xfer_stats_time < 500)
		return;

	if (xfer_stats_done > done)
		xfer_stats_done = 0;
	if (xfer_stats_time < start_time)
		xfer_stats_time = start_time;

	let delta = Math.round((now - start_time) / 1000);
	let instant = Math.round(((done - xfer_stats_done) * 1000) / ((now - xfer_stats_time) * 1024));
	let average = Math.round(done * 1000 / ((now - start_time) * 1024));

	xfer_stats_done = done;
	xfer_stats_time = now;

    let out = "Pushing file to device " + Math.round(100 * done / total) + "%";
	// let out = "";
	// out += Math.round(100 * done / total) + "% (";
	// out += Math.round(done / 1024) + " KiB in ~" + delta + " secs at avg " + average + " KiB/s, cur " + instant + " KiB/s)";
	output(out);
}

async function push_usb(file, to, mode="0644")
{

	try {
		if (adb != null ) {
			state = "running";
			output("Pushing file...");

			sync = await adb.sync();
			let start_time = Date.now();

			await sync.push(file, to, mode,
				(done, total) => xfer_stats(start_time, done, total));

			await sync.quit();
			sync = null;
			state = "connected";
		} else {
            output("Not connected!");
        }
	}
	catch(error) {
		console.log(error);
		output(error.message);
		state = "connected";
	}
}

let is_old_version = false;
async function install() {
    show_install_progress();
    try {

        // Get latest release from GitHub API
        const repo = "threethan/Quest-Game-Tuner"; // Replace with actual repo
        const apiUrl = `https://api.github.com/repos/${repo}/releases/latest`;

        output("Fetching latest release...");
        const response = await fetch(apiUrl);
        if (!response.ok) {
            output(`Failed to fetch release: ${response.statusText}`);
            hide_install_progress();
            return;
        }

        const releaseData = await response.json();
        output(`Found release: ${releaseData.tag_name}`);

        // Find APK asset
        const apkAsset = releaseData.assets.find(asset => 
            asset.name.toLowerCase().endsWith('.apk'));

        if (!apkAsset) {
            throw new Error("No APK file found in latest release");
        }

        output(`Downloading ${apkAsset.name}...`);

		// Download the APK file using CORS proxy
		const proxyUrl = 'https://corsproxy.io/?url=';
		const apkResponse = await fetch(proxyUrl + encodeURI(apkAsset.browser_download_url));
		if (!apkResponse.ok) {
			throw new Error(`Failed to download APK: ${apkResponse.statusText}`);
		}

        const apkBlob = await apkResponse.blob();
        output(`Downloaded ${apkAsset.name} (${Math.round(apkBlob.size / 1024)} KB)`);

        // Use the downloaded file instead of local file
        await push_usb(apkBlob, "/data/local/tmp/" + apkAsset.name, "0644");
        console.log(`Pushed ${apkAsset.name} from ${releaseData.tag_name} release`);

        output("Installing APK (This might take a bit)...");
        await execute_cmd(`shell:pm install -r /data/local/tmp/${apkAsset.name}`);

        if (!last_output.includes("Success")) {
            // Uninstall and retry
            output("Upgrade failed, attempting a clean install...");
            await execute_cmd(`shell:pm uninstall com.threethan.tuner`);
            output("Clean Installing APK (This might take a bit)...")
            await execute_cmd(`shell:pm install -r /data/local/tmp/${apkAsset.name}`);

            if (!last_output.includes("Success")) {
                connection_lost();
            }
        }

        output("Installation complete! Cleaning up...");

        // Delete the APK from device
        await execute_cmd(`shell:rm /data/local/tmp/${apkAsset.name}`);
        output("Cleaned up temporary file. Done.");

        if (state !== "connected") {
            connection_lost();
            return;
        } else {
            output("Installation successful!");
            installation_complete();
        }

        is_old_version = releaseData.tag_name.startsWith("1.9.");
        if (is_old_version) {
            output("Skipping activation check for pre-2.0 version.");
        }
	} catch (error) {
        hide_install_progress();
		console.error("Failed to install:", error);
		output("Failed to install: " + error.message);
	}
}

navigator.usb.addEventListener("disconnect", (event) => {
  console.log("USB device disconnected:", event.device);
    if (webusb != null && event.device === webusb.device) {
        connection_lost();
        disconnect_usb();
    }
});

async function attempt_activation(key) {

    await execute_cmd(`shell:am start -n com.threethan.tuner/.activity.action.ActivationActivity -d ${key}`);
    output("Activation command sent to the app. Verifying...");
    // Wait 5 seconds before checking activation status
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    await execute_cmd(`shell:content query --uri content://com.threethan.tuner.activationStatusProvider/test --projection status --where "key='${key}'"`);
    if (last_output.includes("success") || is_old_version) {
        output("Activation successful! Setting up Quest Game Tuner...");

        // Random 4 digit port between 5555 and 9999
        const port = is_old_version ? 5555 : Math.floor(Math.random() * (9999 - 5555 + 1)) + 5555;
        await execute_cmd(`shell:am start -n com.threethan.tuner/.activity.action.NaiveInitActivity`);
        await execute_cmd(`tcpip:${port}`);
        // Launch the app's main activity
        output(`Setup complete! Quest Game Tuner should now connect via ADB over Wi-Fi on port ${port}.`);

        activation_successful();
        return true;
    } else {
        activation_failed();
        output("Activation failed or not confirmed. Please check the app on your device.");
        return false;
    }
}