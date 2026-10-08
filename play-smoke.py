import subprocess,time,re,xml.etree.ElementTree as ET
def adb(*args):return subprocess.check_output(['adb',*args])
def dump():
    adb('shell','uiautomator','dump','/sdcard/ui.xml')
    xml=adb('shell','cat','/sdcard/ui.xml')
    open('evidence/last-ui.xml','wb').write(xml)
    return ET.fromstring(xml)
def tap(pattern,before_shot=None):
    for node in dump().iter('node'):
        texts=[node.get('text',''),node.get('content-desc','')]
        if any(re.search(pattern,text,re.I) for text in texts):
            b=list(map(int,re.findall(r'\d+',node.get('bounds'))))
            if len(b)!=4 or b[2]<=b[0] or b[3]<=b[1] or b[3]<=102 or b[1]>=1812:continue
            if before_shot:shot(before_shot)
            adb('shell','input','tap',str((b[0]+b[2])//2),str((b[1]+b[3])//2))
            time.sleep(1)
            return True
    return False
def shot(name):
    open('evidence/'+name+'.png','wb').write(adb('exec-out','screencap','-p'))
def wait_tap(pattern,before_shot=None):
    for _ in range(8):
        if tap(pattern,before_shot):return True
        time.sleep(1)
    return False
def has_label(label):
    # Android WebView can expose a button's accessible name as either text or
    # content-desc. Check both, matching the fields used to find the tap target.
    return any(label in (node.get('text',''),node.get('content-desc',''))
               for node in dump().iter('node'))
def clear_system_dialogs():
    for _ in range(4):
        ui=dump();texts=' '.join(n.get('text','') for n in ui.iter('node'))
        if "ETN isn't responding" in texts:raise AssertionError('ETN ANR')
        if "Quickstep isn't responding" in texts:
            assert tap(r'^Close app\s*$')
            time.sleep(5)
        elif "isn't responding" in texts:
            assert tap(r'^Wait\s*$')
            time.sleep(10)
        else:return
    raise AssertionError('Android system remains unresponsive')
clear_system_dialogs()
shot('01-home')
assert wait_tap(r'^Map information$|^Žemėlapio informacija$'), 'Map information toggle missing'
ui=dump(); texts=' '.join(n.get('text','') for n in ui.iter('node'))
assert 'Dark areas are unexplored' in texts or 'Tamsi sritis dar neatrasta' in texts, 'Map explanation did not expand'
shot('11-map-information-open')
assert wait_tap(r'^Map information$|^Žemėlapio informacija$'), 'Map information did not close'
ui=dump(); texts=' '.join(n.get('text','') for n in ui.iter('node'))
assert 'Dark areas are unexplored' not in texts and 'Tamsi sritis dar neatrasta' not in texts, 'Map explanation remained open'
assert 'OpenMapTiles Data from' not in texts, 'Map attribution starts expanded'
assert wait_tap(r'^Map sources$|^Žemėlapio šaltiniai$'), 'Map sources toggle missing'
ui=dump(); texts=' '.join(n.get('text','') for n in ui.iter('node'))
assert 'OpenFreeMap' in texts, 'Map sources did not expand'
assert wait_tap(r'^Map sources$|^Žemėlapio šaltiniai$'), 'Map sources did not close'
ui=dump(); texts=' '.join(n.get('text','') for n in ui.iter('node'))
assert 'OpenMapTiles Data from' not in texts, 'Map sources remained open'
shot('13-map-information-collapsed')
assert wait_tap(r'Language / Kalba|^Language$|\bEN\b'), 'Language selector missing'
assert wait_tap(r'\bRU\b'), 'Russian language missing'
time.sleep(3)
ui=dump(); texts=' '.join(n.get('text','') for n in ui.iter('node'))
assert 'карта откроется.' in texts, 'Russian interface did not load'
shot('07-russian-home')
# The image and compass controls are immediately below the whole-world button.
assert wait_tap(r'^Включить спутниковую карту$'), 'Photo map switch missing'
assert has_label('Выключить спутниковую карту'), 'Photo map did not turn on'
shot('10-photo-map')
assert wait_tap(r'^Показать направление движения вверху$'), 'Compass missing'
assert has_label('Показать север вверху'), 'Heading mode did not turn on'
assert wait_tap(r'^Показать север вверху$'), 'Compass did not return to north-up'
assert wait_tap(r'^Выключить спутниковую карту$'), 'Photo map did not turn off'
open('evidence/map-controls-validation.txt','w').write('Photo map on/off and compass heading-up/north-up controls passed in the Android WebView.\n')
for _ in range(2):
    adb('shell','input','swipe','1070','1650','1070','400','500')
    time.sleep(2)
shot('02-footer')
for _ in range(4):
    if tap(r'^Нашли ошибку\?$'):break
    adb('shell','input','swipe','1070','1650','1070','700','400')
    time.sleep(1)
else:raise AssertionError('Bug report link missing')
ui=dump(); texts=' '.join(n.get('text','') for n in ui.iter('node'))
assert 'ETN DEBUG EMAIL RECEIVER' in texts, 'Native email intent did not open a draft receiver'
assert 'android.intent.action.SENDTO' in texts and 'To: info@tyliaitpk.com' in texts, 'Incorrect email action or recipient'
assert 'ETN v0.6.18' in texts and 'Описание ошибки:' in texts, 'Email draft fields missing'
shot('12-native-email-draft-test')
adb('shell','input','keyevent','4')
time.sleep(1)
for _ in range(4):
    if has_label('Начать исследование ↗'):break
    adb('shell','input','swipe','1070','500','1070','1250','400')
    time.sleep(1)
open('evidence/support-validation.txt','w').write('Android 15: map information expands and closes; bug-report action opens a debug-only SENDTO email receiver with the recipient, version and localized multiline body. No email was sent.\n')
record=subprocess.Popen(['adb','shell','screenrecord','--time-limit','60','/sdcard/ETN-location-demo.mp4'])
assert tap(r'Start exploring|Pradėti tyrinėjimą|Start exploration|Начать исследование'),'Start button missing'
assert wait_tap(r'^OK\s*$','03-location-disclosure'),'Disclosure confirmation missing'
assert wait_tap(r'While using the app|While using this app|Naudojant programėlę','04-location-permission'),'Location permission prompt missing'
assert wait_tap(r'^Allow\s*$|^Leisti\s*$'),'Notification permission prompt missing'
time.sleep(2)
adb('emu','geo','fix','25.2797','54.6872')
time.sleep(4)
services=adb('shell','dumpsys','activity','services','lt.tyliaitpk.etn.next').decode()
open('evidence/services.txt','w').write(services)
assert 'isForeground=true' in services,'Location foreground service not running'
shot('05-exploring')
adb('shell','am','start','-a','android.settings.SETTINGS')
time.sleep(2)
adb('shell','cmd','statusbar','expand-notifications')
time.sleep(2)
shot('06-location-notification')
notes=adb('shell','dumpsys','notification','--noredact').decode()
assert 'ETN исследует окрестности' in notes, 'Russian foreground notification missing'
open('evidence/russian-language-validation.txt','w').write('Russian selector, interface, disclosure and foreground notification passed on an English Android 15 system.\n')
adb('shell','cmd','statusbar','collapse')
adb('shell','am','start','-n','lt.tyliaitpk.etn.next/lt.tyliaitpk.etn.MainActivity')
time.sleep(2)
# First GPS fixes can queue more than one country/settlement dialog.
# A tap on the obscured Stop control is ignored by the WebView.
for _ in range(12):
    if not tap(r'^Continue exploring$|^Tęsti tyrinėjimą$|^Продолжить исследование$'):break
    time.sleep(0.5)
assert wait_tap(r'^Stop\s*$|^Stabdyti\s*$|^Остановить\s*$'),'Stop button missing'
for _ in range(8):
    services=adb('shell','dumpsys','activity','services','lt.tyliaitpk.etn.next').decode()
    if 'isForeground=true' not in services:break
    if tap(r'^Continue exploring$|^Tęsti tyrinėjimą$|^Продолжить исследование$'):
        wait_tap(r'^Stop\s*$|^Stabdyti\s*$|^Остановить\s*$')
    time.sleep(1)
assert 'isForeground=true' not in services,'Location service did not stop'
record.wait(timeout=65)
adb('pull','/sdcard/ETN-location-demo.mp4','evidence/ETN-location-demo.mp4')
open('evidence/smoke-validation.txt','w').write('Android 15: launch, Russian language selection, disclosure, permissions, foreground location start, Russian background notification, stop passed. Coordinates simulated in emulator.\n')


