import subprocess,time,re,xml.etree.ElementTree as ET
def adb(*args):return subprocess.check_output(['adb',*args])
def dump():
    for _ in range(6):
        adb('shell','rm','-f','/sdcard/ui.xml')
        adb('shell','uiautomator','dump','/sdcard/ui.xml')
        try:
            xml=adb('shell','cat','/sdcard/ui.xml')
            root=ET.fromstring(xml)
            open('evidence/last-ui.xml','wb').write(xml)
            return root
        except (subprocess.CalledProcessError,ET.ParseError):
            time.sleep(2)
    raise AssertionError('Android accessibility did not return a fresh UI')
def tap(pattern,before_shot=None,package=None):
    for node in dump().iter('node'):
        if node.get('enabled')=='false' or (package and node.get('package')!=package):continue
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
assert wait_tap(r'Language / Kalba|^Language$|\bEN\b'), 'Language selector missing'
assert wait_tap(r'\bRU\b'), 'Russian language missing'
time.sleep(3)
ui=dump(); texts=' '.join(n.get('text','') for n in ui.iter('node'))
assert 'карта откроется.' in texts, 'Russian interface did not load'
shot('07-russian-home')
for _ in range(2):
    adb('shell','input','swipe','1070','1650','1070','400','500')
    time.sleep(2)
shot('02-footer')
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
# Read a fresh app UI after returning from Android notifications. Discovery
# dialogs can cover the Stop button even while it remains in accessibility XML.
time.sleep(3)
clear_system_dialogs()
stop_pattern=r'^Stop\s*$|^Stabdyti\s*$|^Остановить\s*$'
continue_pattern=r'^Continue exploring$|^Tęsti tyrinėjimą$|^Продолжить исследование$'
stop_clicked=False
deadline=time.monotonic()+90
while time.monotonic()<deadline:
    services=adb('shell','dumpsys','activity','services','lt.tyliaitpk.etn.next').decode()
    open('evidence/services-after-stop.txt','w').write(services)
    if 'isForeground=true' not in services:break
    if tap(continue_pattern,package='lt.tyliaitpk.etn.next'):
        time.sleep(0.5)
        continue
    if tap(stop_pattern,before_shot='08-stop-control',package='lt.tyliaitpk.etn.next'):
        stop_clicked=True
    time.sleep(2)
services=adb('shell','dumpsys','activity','services','lt.tyliaitpk.etn.next').decode()
assert stop_clicked,'No enabled Stop control was tapped in the ETN application'
if 'isForeground=true' in services:
    ui=dump()
    controls=[{'enabled':node.get('enabled'),'bounds':node.get('bounds'),'app':node.get('package')=='lt.tyliaitpk.etn.next'}
        for node in ui.iter('node') if re.search(stop_pattern,node.get('text',''),re.I)]
    print('STOP CONTROL STATE:',controls,flush=True)
assert 'isForeground=true' not in services,'Location service did not stop'
shot('09-stopped')
record.wait(timeout=65)
adb('pull','/sdcard/ETN-location-demo.mp4','evidence/ETN-location-demo.mp4')
open('evidence/smoke-validation.txt','w').write('Android 15: launch, Russian language selection, disclosure, permissions, foreground location start, Russian background notification, stop passed. Coordinates simulated in emulator.\n')

