from contentbase.upgrader import upgrade_step


@upgrade_step('family', '1', '2')
def family_1_2(value, system):
    # https://github.com/ClinGen/clincoded/issues/453
    value['status'] = 'in progress'