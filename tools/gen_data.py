#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Generate data/timezones.json — curated IANA timezone list for the extension.

Usage:  python tools/gen_data.py
Output: data/timezones.json  (committed; regenerate only when the list changes)
"""
import json
import os

# Curated canonical IANA zone IDs (aliases / deprecated names intentionally excluded).
RAW = {
    "Africa": [
        "Abidjan", "Accra", "Addis_Ababa", "Algiers", "Cairo", "Casablanca",
        "El_Aaiun", "Johannesburg", "Juba", "Khartoum", "Lagos", "Maputo",
        "Monrovia", "Nairobi", "Ndjamena", "Tripoli", "Tunis", "Windhoek",
    ],
    "America": [
        "Adak", "Anchorage", "Argentina/Buenos_Aires", "Argentina/Cordoba",
        "Argentina/Mendoza", "Argentina/Salta", "Argentina/San_Luis",
        "Argentina/Tucuman", "Argentina/Ushuaia", "Asuncion", "Atikokan",
        "Bahia", "Bahia_Banderas", "Barbados", "Belem", "Belize", "Blanc-Sablon",
        "Boa_Vista", "Bogota", "Boise", "Buenos_Aires", "Cambridge_Bay",
        "Campo_Grande", "Cancun", "Caracas", "Catamarca", "Cayenne", "Cayman",
        "Chicago", "Chihuahua", "Ciudad_Juarez", "Costa_Rica", "Creston",
        "Cuiaba", "Curacao", "Danmarkshavn", "Dawson", "Dawson_Creek", "Denver",
        "Detroit", "Edmonton", "Eirunepe", "El_Salvador", "Fortaleza",
        "Fort_Nelson", "Glace_Bay", "Godthab", "Goose_Bay", "Grand_Turk",
        "Guatemala", "Guayaquil", "Guyana", "Halifax", "Havana", "Hermosillo",
        "Indiana/Indianapolis", "Indiana/Knox", "Indiana/Marengo",
        "Indiana/Petersburg", "Indiana/Tell_City", "Indiana/Vevay",
        "Indiana/Vincennes", "Indiana/Winamac", "Inuvik", "Iqaluit", "Jamaica",
        "Jujuy", "Juneau", "Kentucky/Louisville", "Kentucky/Monticello",
        "Kralendijk", "La_Paz", "Lima", "Los_Angeles", "Louisville",
        "Lower_Princes", "Maceio", "Managua", "Manaus", "Marigot", "Martinique",
        "Matamoros", "Mazatlan", "Mendoza", "Menominee", "Merida", "Metlakatla",
        "Mexico_City", "Miquelon", "Moncton", "Monterrey", "Montevideo",
        "Montreal", "Montserrat", "Nassau", "New_York", "Nipigon", "Nome",
        "Noronha", "North_Dakota/Beulah", "North_Dakota/Center",
        "North_Dakota/New_Salem", "Nuuk", "Ojinaga", "Panama", "Paramaribo",
        "Phoenix", "Port-au-Prince", "Port_of_Spain", "Porto_Velho",
        "Puerto_Rico", "Punta_Arenas", "Rainy_River", "Rankin_Inlet", "Recife",
        "Regina", "Resolute", "Rio_Branco", "Santa_Isabel", "Santarem",
        "Santiago", "Santo_Domingo", "Sao_Paulo", "Scoresbysund", "Sitka",
        "St_Johns", "Swift_Current", "Tegucigalpa", "Thule", "Thunder_Bay",
        "Tijuana", "Toronto", "Tortola", "Vancouver", "Whitehorse", "Winnipeg",
        "Yakutat", "Yellowknife",
    ],
    "Antarctica": [
        "Casey", "Davis", "DumontDUrville", "Macquarie", "Mawson", "McMurdo",
        "Palmer", "Rothera", "Syowa", "Troll", "Vostok",
    ],
    "Asia": [
        "Aden", "Almaty", "Amman", "Anadyr", "Aqtau", "Aqtobe", "Ashgabat",
        "Atyrau", "Baghdad", "Bahrain", "Baku", "Bangkok", "Barnaul", "Beirut",
        "Bishkek", "Brunei", "Chita", "Choibalsan", "Colombo", "Damascus",
        "Dhaka", "Dili", "Dubai", "Dushanbe", "Famagusta", "Gaza", "Hebron",
        "Ho_Chi_Minh", "Hong_Kong", "Hovd", "Irkutsk", "Jakarta", "Jayapura",
        "Jerusalem", "Kabul", "Kamchatka", "Karachi", "Kashgar", "Kathmandu",
        "Khandyga", "Kolkata", "Krasnoyarsk", "Kuala_Lumpur", "Kuching",
        "Macau", "Magadan", "Makassar", "Manila", "Muscat", "Nicosia",
        "Novokuznetsk", "Novosibirsk", "Omsk", "Oral", "Phnom_Penh",
        "Pontianak", "Pyongyang", "Qatar", "Qostanay", "Qyzylorda", "Riyadh",
        "Sakhalin", "Samarkand", "Seoul", "Shanghai", "Singapore",
        "Srednekolymsk", "Taipei", "Tashkent", "Tbilisi", "Tehran", "Thimphu",
        "Tokyo", "Tomsk", "Ulaanbaatar", "Urumqi", "Ust-Nera", "Vientiane",
        "Vladivostok", "Yakutsk", "Yangon", "Yekaterinburg", "Yerevan",
    ],
    "Atlantic": [
        "Azores", "Bermuda", "Canary", "Cape_Verde", "Faroe", "Madeira",
        "Reykjavik", "South_Georgia", "St_Helena", "Stanley",
    ],
    "Australia": [
        "Adelaide", "Brisbane", "Broken_Hill", "Darwin", "Eucla", "Hobart",
        "Lindeman", "Lord_Howe", "Melbourne", "Perth", "Sydney",
    ],
    "Europe": [
        "Amsterdam", "Andorra", "Astrakhan", "Athens", "Belgrade", "Berlin",
        "Bratislava", "Brussels", "Bucharest", "Budapest", "Busingen",
        "Chisinau", "Copenhagen", "Dublin", "Gibraltar", "Guernsey", "Helsinki",
        "Isle_of_Man", "Istanbul", "Jersey", "Kaliningrad", "Kirov", "Kyiv",
        "Lisbon", "Ljubljana", "London", "Luxembourg", "Madrid", "Malta",
        "Mariehamn", "Minsk", "Monaco", "Moscow", "Oslo", "Paris", "Podgorica",
        "Prague", "Riga", "Rome", "Samara", "San_Marino", "Sarajevo",
        "Saratov", "Simferopol", "Skopje", "Sofia", "Stockholm", "Tallinn",
        "Tirane", "Tiraspol", "Ulyanovsk", "Uzhgorod", "Vaduz", "Vatican",
        "Vienna", "Vilnius", "Volgograd", "Warsaw", "Zagreb", "Zaporozhye",
        "Zurich",
    ],
    "Indian": [
        "Antananarivo", "Chagos", "Christmas", "Cocos", "Comoro", "Kerguelen",
        "Mahe", "Maldives", "Mauritius", "Mayotte", "Reunion",
    ],
    "Pacific": [
        "Apia", "Auckland", "Bougainville", "Chatham", "Chuuk", "Easter",
        "Efate", "Enderbury", "Fakaofo", "Fiji", "Funafuti", "Galapagos",
        "Gambier", "Guadalcanal", "Guam", "Honolulu", "Johnston", "Kanton",
        "Kiritimati", "Kosrae", "Kwajalein", "Majuro", "Marquesas", "Midway",
        "Nauru", "Niue", "Norfolk", "Noumea", "Pago_Pago", "Palau", "Pitcairn",
        "Pohnpei", "Port_Moresby", "Rarotonga", "Saipan", "Tahiti", "Tarawa",
        "Tongatapu", "Wake", "Wallis", "Yap",
    ],
    "Etc": ["UTC", "GMT"],
}

# Display-name overrides (English, CLDR-style). Regions are localized at runtime.
SPECIAL = {
    "America/Argentina/Buenos_Aires": "Buenos Aires",
    "America/Argentina/Cordoba": "Córdoba",
    "America/Asuncion": "Asunción",
    "America/Blanc-Sablon": "Blanc-Sablon",
    "America/Indiana/Indianapolis": "Indianapolis, Indiana",
    "America/Indiana/Knox": "Knox, Indiana",
    "America/Indiana/Marengo": "Marengo, Indiana",
    "America/Indiana/Petersburg": "Petersburg, Indiana",
    "America/Indiana/Tell_City": "Tell City, Indiana",
    "America/Indiana/Vevay": "Vevay, Indiana",
    "America/Indiana/Vincennes": "Vincennes, Indiana",
    "America/Indiana/Winamac": "Winamac, Indiana",
    "America/Kentucky/Louisville": "Louisville, Kentucky",
    "America/Los_Angeles": "Los Angeles",
    "America/Mexico_City": "Mexico City",
    "America/North_Dakota/Beulah": "Beulah, North Dakota",
    "America/North_Dakota/Center": "Center, North Dakota",
    "America/North_Dakota/New_Salem": "New Salem, North Dakota",
    "America/Port-au-Prince": "Port-au-Prince",
    "America/Sao_Paulo": "São Paulo",
    "America/St_Johns": "St. John's",
    "Antarctica/McMurdo": "McMurdo",
    "Asia/Ho_Chi_Minh": "Ho Chi Minh City",
    "Asia/Hong_Kong": "Hong Kong, China",
    "Asia/Macau": "Macao, China",
    "Asia/Taipei": "Taipei, China",
    "Australia/Lord_Howe": "Lord Howe Island",
    "Etc/UTC": "UTC",
    "Europe/Busingen": "Büsingen",
    "Europe/Kyiv": "Kyiv",
    "Europe/Uzhgorod": "Uzhhorod",
    "Europe/Vatican": "Vatican City",
    "Europe/Zaporozhye": "Zaporizhzhia",
    "Pacific/Noumea": "Nouméa",
    "Pacific/Port_Moresby": "Port Moresby",
}

POPULAR = [
    "Asia/Shanghai", "Asia/Tokyo", "Asia/Seoul", "Asia/Singapore",
    "Asia/Hong_Kong", "Asia/Taipei", "Asia/Kolkata", "Asia/Jakarta",
    "Asia/Bangkok", "Asia/Manila", "Asia/Dubai", "Europe/London",
    "Europe/Paris", "Europe/Berlin", "Europe/Madrid", "Europe/Moscow",
    "Europe/Amsterdam", "America/New_York", "America/Chicago",
    "America/Denver", "America/Los_Angeles", "America/Sao_Paulo",
    "America/Mexico_City", "America/Toronto", "Australia/Sydney",
    "Pacific/Auckland", "Africa/Cairo", "Africa/Johannesburg",
]

def display_name(zone_id):
    if zone_id in SPECIAL:
        return SPECIAL[zone_id]
    return zone_id.rsplit("/", 1)[-1].replace("_", " ")

def main():
    zones = []
    seen = set()
    for region, names in RAW.items():
        for name in names:
            zid = "%s/%s" % (region, name)
            if zid in seen:
                continue
            seen.add(zid)
            zones.append({
                "id": zid,
                "region": region,
                "name": display_name(zid),
                "popular": zid in POPULAR,
            })
    zones.sort(key=lambda z: z["id"])
    # sanity: every popular id must exist in the list
    ids = {z["id"] for z in zones}
    missing = [p for p in POPULAR if p not in ids]
    if missing:
        raise SystemExit("POPULAR ids missing from RAW: %s" % missing)
    out = {"count": len(zones), "popular": POPULAR, "zones": zones}
    here = os.path.dirname(os.path.abspath(__file__))
    dest = os.path.join(here, "..", "data", "timezones.json")
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    with open(dest, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print("wrote %s (%d zones, %d popular)" % (dest, len(zones), len(POPULAR)))

if __name__ == "__main__":
    main()
