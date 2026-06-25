#!/usr/bin/env python3
"""自动更新国证A指、沪深300全收益、非纯债基指数数据"""

import akshare as ak
import json
import time
from datetime import datetime, timedelta

ASSETS_DIR = "assets"


def update_gza_data():
    """更新国证A指数据"""
    print("=== 更新国证A指数据 ===")
    end_date = datetime.now().strftime("%Y%m%d")

    df = ak.stock_zh_index_daily(symbol="sz399317")
    df['date'] = df['date'].astype(str)

    dates = df['date'].tolist()
    close = [round(float(x), 2) for x in df['close'].tolist()]

    print(f"  数据范围: {dates[0]} ~ {dates[-1]}, 共{len(dates)}条")

    js = f"""// GZA Index (399317) Daily Data
// Auto-updated: {datetime.now().strftime('%Y-%m-%d')}
// Data source: AKShare (Sina Finance)

var GZA_DATES = {json.dumps(dates)};
var GZA_CLOSE = {json.dumps(close)};
"""

    with open(f"{ASSETS_DIR}/gza-data.js", "w") as f:
        f.write(js)
    print("  已保存 gza-data.js")


def update_csi300_data():
    """更新沪深300全收益 + 非纯债基指数数据"""
    print("\n=== 更新沪深300全收益 + 非纯债基指数 ===")
    end_date = datetime.now().strftime("%Y%m%d")

    df300 = ak.stock_zh_index_hist_csindex(symbol="H00300", start_date="20020101", end_date=end_date)
    df_fund = ak.stock_zh_index_hist_csindex(symbol="930897", start_date="20020101", end_date=end_date)

    df300['日期'] = df300['日期'].astype(str)
    df_fund['日期'] = df_fund['日期'].astype(str)

    # 找到930897实际数据起始
    fund_dates = df_fund['日期'].tolist()
    real_start_idx = 0
    for i, d in enumerate(fund_dates):
        if d not in ['2002-01-01', '2014-12-31']:
            real_start_idx = i
            break

    start_idx_300 = df300[df300['日期'] == fund_dates[real_start_idx]].index[0]
    df300_aligned = df300.iloc[start_idx_300:].reset_index(drop=True)
    df_fund_aligned = df_fund.iloc[real_start_idx:].reset_index(drop=True)

    common_dates = sorted(set(df300_aligned['日期']) & set(df_fund_aligned['日期']))

    price_300 = dict(zip(df300_aligned['日期'], df300_aligned['收盘']))
    price_fund = dict(zip(df_fund_aligned['日期'], df_fund_aligned['收盘']))

    close300_list = [float(price_300[d]) for d in common_dates]
    closefund_list = [float(price_fund[d]) for d in common_dates]

    # 归一化沪深300，起始100
    new_close300 = [100.0]
    for i in range(1, len(common_dates)):
        ret = (close300_list[i] - close300_list[i - 1]) / close300_list[i - 1]
        new_close300.append(new_close300[-1] * (1 + ret))

    # 归一化非纯债基，起始100，每日涨跌幅缩小为60%，平移-70使起始=30
    new_closefund = [100.0]
    for i in range(1, len(common_dates)):
        ret = (closefund_list[i] - closefund_list[i - 1]) / closefund_list[i - 1]
        new_closefund.append(new_closefund[-1] * (1 + ret * 0.6))

    shifted_fund = [round(v - 70, 2) for v in new_closefund]

    print(f"  数据范围: {common_dates[0]} ~ {common_dates[-1]}, 共{len(common_dates)}条")
    print(f"  沪深300: {new_close300[0]:.2f} -> {new_close300[-1]:.2f}")
    print(f"  非纯债基: {shifted_fund[0]:.2f} -> {shifted_fund[-1]:.2f}")

    js = f"""// CSI 300 Total Return Index + CSI Non-pure Bond Fund Index
// CSI300 starts at 100, Fund starts at 30 (shifted -70), daily return scaled to 60%
// Auto-updated: {datetime.now().strftime('%Y-%m-%d')}
// Data source: AKShare (CSIndex)

var CSI300_DATES = {json.dumps(common_dates)};
var CSI300_CLOSE = {json.dumps([round(v, 2) for v in new_close300])};
var MIXFUND_CLOSE = {json.dumps(shifted_fund)};
"""

    with open(f"{ASSETS_DIR}/csi300-data.js", "w") as f:
        f.write(js)
    print("  已保存 csi300-data.js")


if __name__ == "__main__":
    update_gza_data()
    time.sleep(2)
    update_csi300_data()
    print("\n=== 数据更新完成 ===")
