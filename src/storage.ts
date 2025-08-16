import fs from "fs";
import path from "path";

const FILE_PATH = path.join(__dirname, "installations.json");

interface Installation {
  companyId: string;
  locationId?: string;
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export class Storage {
  static getAll(): Installation[] {
    if (!fs.existsSync(FILE_PATH)) return [];
    const data = fs.readFileSync(FILE_PATH, "utf-8");
    return JSON.parse(data || "[]");
  }

  static save(inst: Installation) {
    const all = Storage.getAll();
    const idx = all.findIndex(
      (i) =>
        i.companyId === inst.companyId &&
        (inst.locationId ? i.locationId === inst.locationId : true)
    );
    if (idx > -1) {
      all[idx] = inst;
    } else {
      all.push(inst);
    }
    fs.writeFileSync(FILE_PATH, JSON.stringify(all, null, 2));
  }

  static find(resourceId: string): Installation | undefined {
    const all = Storage.getAll();
    return all.find((i) => i.companyId === resourceId || i.locationId === resourceId);
  }

  /** Get access token for a specific location */
  static getTokenForLocation(locationId: string): string | null {
    const inst = this.getAll().find((i) => i.locationId === locationId);
    return inst?.access_token || null;
  }
}
